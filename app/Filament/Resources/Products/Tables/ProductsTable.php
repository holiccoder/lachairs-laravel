<?php

namespace App\Filament\Resources\Products\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Support\Facades\Storage;

class ProductsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                ImageColumn::make('image')
                    ->label('图片')
                    ->square()
                    ->size(48)
                    // Image paths come from two sources:
                    //   - Seeder writes directly to public/images/products/<slug>/foo.jpg
                    //     and stores "images/products/<slug>/foo.jpg" → URL is /images/...
                    //   - FileUpload (admin form) writes to the `public` storage disk
                    //     (storage/app/public/...) → URL is /storage/...
                    // Resolve both here rather than committing the column to one disk.
                    ->getStateUsing(function ($record) {
                        $path = $record->image;
                        if (! $path) {
                            return null;
                        }
                        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
                            return $path;
                        }
                        if (str_starts_with($path, 'images/')) {
                            return asset($path);
                        }
                        return Storage::disk('public')->url($path);
                    }),
                TextColumn::make('name')
                    ->label('商品名称')
                    ->searchable()
                    ->sortable()
                    ->limit(50)
                    ->wrap(),
                TextColumn::make('sku')
                    ->label('商品编码')
                    ->searchable()
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('category.name')
                    ->label('分类')
                    ->searchable()
                    ->sortable()
                    ->placeholder('—'),
                TextColumn::make('brand')
                    ->label('品牌')
                    ->searchable()
                    ->placeholder('—')
                    ->toggleable(),
                TextColumn::make('price')
                    ->label('价格')
                    ->money('USD')
                    ->sortable()
                    ->placeholder('—'),
                TextColumn::make('stock')
                    ->label('库存')
                    ->numeric()
                    ->sortable()
                    ->badge()
                    ->color(fn ($state) => $state > 0 ? 'success' : 'danger'),
                IconColumn::make('is_active')
                    ->label('上架中')
                    ->boolean(),
                TextColumn::make('updated_at')
                    ->label('更新时间')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('updated_at', 'desc')
            ->filters([
                SelectFilter::make('product_category_id')
                    ->label('分类')
                    ->relationship('category', 'name')
                    ->searchable()
                    ->preload(),
                SelectFilter::make('brand')
                    ->label('品牌')
                    ->options(fn () => \App\Models\Product::query()
                        ->whereNotNull('brand')
                        ->select('brand')
                        ->distinct()
                        ->pluck('brand', 'brand')
                        ->all()),
                TernaryFilter::make('is_active')
                    ->label('上架状态')
                    ->placeholder('全部')
                    ->trueLabel('仅上架')
                    ->falseLabel('仅下架'),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
