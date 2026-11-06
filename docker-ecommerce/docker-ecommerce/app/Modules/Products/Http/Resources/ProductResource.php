<?php

namespace App\Modules\Products\Http\Resources;

use App\Services\WarehouseGrpcService;
use Illuminate\Http\Resources\Json\JsonResource;
use Exception;

class ProductResource extends JsonResource
{
    public function toArray($request): array
    {
        // Only fetch stock when the warehouse is reachable; degrade gracefully.
        $stock = null;
        try {
            /** @var WarehouseGrpcService $warehouse */
            $warehouse = app(WarehouseGrpcService::class);
            $stock = $warehouse->getStock($this->id);
        } catch (Exception) {
            // Warehouse unavailable — return null so the frontend can show a placeholder
        }

        return [
            'id'             => $this->id,
            'name'           => $this->name,
            'description'    => $this->description,
            'price'          => (string) $this->price,
            'category'       => $this->category,
            // imageUrl() is an accessor method on the Product model
            'image_url'      => $this->imageUrl(),
            'stock_quantity' => $stock,
            'created_at'     => $this->created_at?->toIso8601String(),
            'updated_at'     => $this->updated_at?->toIso8601String(),
        ];
    }
}
