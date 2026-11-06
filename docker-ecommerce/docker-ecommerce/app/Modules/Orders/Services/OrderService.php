<?php

namespace App\Modules\Orders\Services;

use App\Modules\Orders\Enums\OrderStatus;
use App\Modules\Orders\Events\OrderPlaced;
use App\Modules\Orders\Events\OrderStatusChanged;
use App\Modules\Orders\Models\Order;
use App\Modules\Orders\Models\OrderItem;
use App\Modules\Products\Contracts\ProductCatalog;
use App\Services\WarehouseGrpcService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Modules\Shared\Exceptions\ApiException;
use Exception;

class OrderService
{
    public function __construct(
        private readonly WarehouseGrpcService $warehouse,
        private readonly ProductCatalog $catalog,
    ) {}

    /**
     * Place a new order.
     *
     * Flow:
     *   1. Resolve product names + prices from the Products module.
     *   2. Attempt warehouse stock reservation (gRPC).
     *   3. Persist order + items inside a DB transaction.
     *   4. On DB failure → release the reservation (compensating action).
     *
     * @param  int    $userId
     * @param  array<array{product_id: int, quantity: int}>  $items
     */
    public function place(int $userId, array $items): Order
    {
        // 1. Resolve product data from the Products module (name + price)
        $productIds = array_column($items, 'product_id');
        $products   = $this->catalog->findByIds($productIds);

        // Validate all requested products exist
        foreach ($productIds as $id) {
            if (! isset($products[$id])) {
                throw new ApiException(422, 'PRODUCT_NOT_FOUND', "Product #{$id} does not exist.");
            }
        }

        // 2. Reserve stock via gRPC — atomic, all-or-nothing
        $reservationId = (string) Str::uuid();
        $shortages     = [];
        $reserved      = $this->warehouse->reserveStock($items, $reservationId, $shortages);

        if (! $reserved) {
            $detail = collect($shortages)->map(
                fn ($s) => "Product #{$s['product_id']}: requested {$s['requested']}, available {$s['available']}"
            )->join('; ');

            throw new ApiException(422, 'STOCK_INSUFFICIENT', "Insufficient stock: {$detail}");
        }

        // 3. Persist order inside a transaction — if this fails, release the reservation
        try {
            $order = DB::transaction(function () use ($userId, $items, $products, $reservationId) {
                $total = collect($items)->sum(
                    fn ($item) => (float) $products[$item['product_id']]['price'] * $item['quantity']
                );

                $order = Order::create([
                    'user_id' => $userId,
                    'status'  => OrderStatus::Pending->value,
                    'total'   => $total,
                ]);

                foreach ($items as $item) {
                    $product = $products[$item['product_id']];
                    OrderItem::create([
                        'order_id'     => $order->id,
                        'product_id'   => $item['product_id'],
                        'product_name' => $product['name'],
                        'unit_price'   => $product['price'],
                        'quantity'     => $item['quantity'],
                    ]);
                }

                return $order;
            });
        } catch (Exception $e) {
            // Compensating action: return stock to warehouse
            $this->warehouse->releaseStock($reservationId);

            throw new ApiException(500, 'ORDER_CREATION_FAILED',
                'Order could not be saved. Stock reservation has been released.');
        }

        OrderPlaced::dispatch($order->id, $userId, (string) $order->total);

        return $order->load('items');
    }

    /**
     * Admin-only: transition an order to a new status.
     */
    public function changeStatus(Order $order, OrderStatus $next): Order
    {
        if (! $order->status->canTransitionTo($next)) {
            throw new ApiException(
                422,
                'INVALID_STATUS_TRANSITION',
                "Cannot transition from '{$order->status->value}' to '{$next->value}'."
            );
        }

        $from = $order->status->value;
        $order->update(['status' => $next->value]);

        OrderStatusChanged::dispatch($order->id, $order->user_id, $from, $next->value);

        return $order->fresh('items');
    }
}
