<?php

namespace Tests\Unit;

use App\Services\Analytics\CsvExporter;
use PHPUnit\Framework\TestCase;

/** OWASP « CSV Injection » : une cellule qui commence par = + - @ deviendrait une formule dans Excel */
class CsvSanitizeTest extends TestCase
{
    public function test_les_formules_sont_neutralisees(): void
    {
        $this->assertSame("'=HYPERLINK(\"http://pirate\",\"Cliquez\")", CsvExporter::sanitize('=HYPERLINK("http://pirate","Cliquez")'));
        $this->assertSame("'+33 rue", CsvExporter::sanitize('+33 rue'));
        $this->assertSame("'@SUM(A1)", CsvExporter::sanitize('@SUM(A1)'));
    }

    public function test_les_nombres_et_textes_ordinaires_sont_intacts(): void
    {
        $this->assertSame(-5, CsvExporter::sanitize(-5));
        $this->assertSame('-5', CsvExporter::sanitize('-5'));       // nombre négatif écrit en texte : reste un nombre
        $this->assertSame('Crème capillaire', CsvExporter::sanitize('Crème capillaire'));
        $this->assertNull(CsvExporter::sanitize(null));
    }
}
