<?php

namespace App\Services;

use Warehouse\V1\GetStockRequest;
use Warehouse\V1\ReserveStockRequest;
use Warehouse\V1\ReleaseStockRequest;
use Warehouse\V1\StockItem;
use Warehouse\V1\WarehouseClient;
use Illuminate\Support\Facades\Log;
use Exception;

class WarehouseGrpcService
{
    protected WarehouseClient $client;

    public function __construct()
    {
        $host = config('services.warehouse.host', 'warehouse:50051');
        $this->client = new WarehouseClient($host, [
            'credentials' => \Grpc\ChannelCredentials::createInsecure(),
        ]);
    }

    /**
     * Returns available stock quantity for a product.
     * Returns 0 if the product is not registered in the warehouse.
     * Throws on service unavailability.
     */
    public function getStock(int $productId): int
    {
        $request = new GetStockRequest();
        $request->setProductId($productId);

        [$response, $status] = $this->client->GetStock($request)->wait();

        if ($status->code === \Grpc\STATUS_NOT_FOUND) {
            return 0;
        }

        if ($status->code !== \Grpc\STATUS_OK) {
            throw new Exception("Warehouse GetStock error: " . $status->details, 503);
        }

        // Proto field: available (not quantity)
        return $response->getAvailable();
    }

    /**
     * Reserves stock for all items atomically.
     * Returns true on success.
     * Returns false when stock is insufficient (sets $shortages).
     * Throws on service errors.
     *
     * @param  array<array{product_id: int, quantity: int}>  $items
     * @param  string  $reservationId  Unique ID (UUID) linking reservation to the order
     * @param  array   &$shortages     Populated with shortage details on failure
     */
    public function reserveStock(array $items, string $reservationId, array &$shortages = []): bool
    {
        $request = new ReserveStockRequest();
        // Proto field: reservation_id (not order_id)
        $request->setReservationId($reservationId);

        $stockItems = [];
        foreach ($items as $item) {
            $stockItem = new StockItem();
            $stockItem->setProductId((int) $item['product_id']);
            $stockItem->setQuantity((int) $item['quantity']);
            $stockItems[] = $stockItem;
        }
        $request->setItems($stockItems);

        [$response, $status] = $this->client->ReserveStock($request)->wait();

        if ($status->code !== \Grpc\STATUS_OK) {
            throw new Exception("Warehouse ReserveStock error: " . $status->details, 503);
        }

        if (! $response->getReserved()) {
            // Collect shortage details for the caller
            foreach ($response->getShortages() as $shortage) {
                $shortages[] = [
                    'product_id' => $shortage->getProductId(),
                    'requested'  => $shortage->getRequested(),
                    'available'  => $shortage->getAvailable(),
                ];
            }
            return false;
        }

        return true;
    }

    /**
     * Releases a previously reserved stock.
     * Idempotent — safe to call more than once for the same reservationId.
     *
     * @param  string  $reservationId
     */
    public function releaseStock(string $reservationId): void
    {
        try {
            $request = new ReleaseStockRequest();
            // Proto field: reservation_id (not order_id)
            $request->setReservationId($reservationId);

            [$response, $status] = $this->client->ReleaseStock($request)->wait();

            if ($status->code !== \Grpc\STATUS_OK) {
                Log::warning("ReleaseStock non-OK for reservation {$reservationId}: " . $status->details);
            }
        } catch (Exception $e) {
            // تسجيل الخطأ فقط — الإرجاع العكسي يجب ألا يوقف تنفيذ الكود
            Log::error("ReleaseStock failed for reservation {$reservationId}: " . $e->getMessage());
        }
    }
}