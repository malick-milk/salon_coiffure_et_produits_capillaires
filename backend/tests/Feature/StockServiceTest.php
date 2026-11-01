<?php

namespace Tests\Feature;

use App\Enums\StockMovementType;
use App\Exceptions\InsufficientStockException;
use App\Models\Product;
use App\Services\Inventory\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Tests\TestCase;

/** Grand livre du stock (RG-STK-01, RG-STK-02, ADR-006) */
class StockServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_le_stock_en_cache_est_toujours_egal_a_la_somme_du_grand_livre(): void
    {
        foreach (Product::all() as $product) {
            $this->assertSame($product->stock_quantity, (int) $product->stockMovements()->sum('quantity'), $product->sku);
        }
    }

    public function test_une_sortie_superieure_au_stock_est_refusee_et_rien_n_est_enregistre(): void
    {
        $serum = Product::where('sku', 'DAB-SAP-030')->firstOrFail(); // 24 en stock
        $before = $serum->stockMovements()->count();

        try {
            app(StockService::class)->record($serum, StockMovementType::Sale, -30);
            $this->fail('Une exception était attendue.');
        } catch (InsufficientStockException $e) {
            $this->assertSame(['product_id' => $serum->id, 'name' => 'Sérum Activ’Pousse 30 ml', 'requested' => 30, 'available' => 24], $e->items[0]);
        }
        $this->assertSame(24, $serum->fresh()->stock_quantity);
        $this->assertSame($before, $serum->stockMovements()->count());
    }

    public function test_une_perte_exige_un_motif_et_met_a_jour_le_stock(): void
    {
        $masque = Product::where('sku', 'DAB-MAS-001')->firstOrFail();
        $stock = app(StockService::class);

        $this->expectException(LogicException::class);
        try {
            $stock->record($masque, StockMovementType::Loss, -2);
        } finally {
            $movement = $stock->record($masque, StockMovementType::Loss, -2, reason: 'Pots abîmés');
            $this->assertSame(22, $movement->stock_after);
            $this->assertSame(22, $masque->fresh()->stock_quantity);
        }
    }

    public function test_le_cout_unitaire_d_un_lot_est_calcule_par_mysql(): void
    {
        // 25 600 F pour 96 sérums = 266,67 F (colonne générée, jamais saisie)
        $this->assertSame('266.67', Product::where('sku', 'DAB-SAP-030')->value('cost_price'));
    }
}
