<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\RecordPurchaseReceiptAction;
use App\Http\Controllers\Controller;
use App\Models\PurchaseReceipt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Réceptions d'achat des produits revendus (maquette validée le 16 novembre 2026) */
class PurchaseReceiptAdminController extends Controller
{
    public function index(): JsonResponse
    {
        $receipts = PurchaseReceipt::query()->with(['product.brand', 'author'])->latest('received_on')->latest('id')->limit(100)->get();

        return response()->json(['data' => $receipts->map(fn (PurchaseReceipt $r) => $this->row($r))]);
    }

    public function store(Request $request, RecordPurchaseReceiptAction $record): JsonResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'supplier_name' => ['required', 'string', 'min:2', 'max:150'],
            'supplier_invoice' => ['nullable', 'string', 'max:60'],
            'received_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'quantity' => ['required', 'integer', 'min:1', 'max:100000'],
            'unit_price' => ['required', 'integer', 'min:0', 'max:10000000'],
            'extra_costs' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [], ['supplier_name' => 'fournisseur', 'received_on' => 'date de réception', 'quantity' => 'quantité', 'unit_price' => "prix d'achat unitaire"]);
        $receipt = $record->execute($data, $request->user());

        return response()->json(['data' => $this->row($receipt->load(['product.brand', 'author']))], 201);
    }

    private function row(PurchaseReceipt $r): array
    {
        return [
            'id' => $r->id, 'product_id' => $r->product_id, 'product_name' => $r->product->displayName(), 'brand' => $r->product->brand?->name,
            'supplier_name' => $r->supplier_name, 'supplier_invoice' => $r->supplier_invoice, 'received_on' => $r->received_on->toDateString(),
            'quantity' => $r->quantity, 'unit_price' => $r->unit_price, 'extra_costs' => $r->extra_costs, 'unit_cost' => (float) $r->unit_cost,
            'total' => $r->quantity * $r->unit_price + $r->extra_costs, 'author' => $r->author ? trim($r->author->first_name.' '.$r->author->last_name) : null, 'notes' => $r->notes,
        ];
    }
}
