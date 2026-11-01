<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Brand extends Model
{
    protected $fillable = ['name', 'slug', 'logo_path', 'is_house_brand', 'is_active'];

    protected function casts(): array { return ['is_house_brand' => 'boolean', 'is_active' => 'boolean']; }

    public function products(): HasMany { return $this->hasMany(Product::class); }
}
