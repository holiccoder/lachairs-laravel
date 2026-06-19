<?php

namespace App\Filament\Resources\Orders\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class OrdersTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('order_number')
                    ->label('订单号')
                    ->searchable()
                    ->copyable()
                    ->weight('medium'),
                TextColumn::make('created_at')
                    ->label('下单时间')
                    ->dateTime('Y-m-d H:i')
                    ->sortable(),
                TextColumn::make('customer_name')
                    ->label('客户')
                    ->searchable(['customer_name', 'customer_email']),
                TextColumn::make('customer_email')
                    ->label('邮箱')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('total')
                    ->label('总金额')
                    ->money('USD')
                    ->sortable()
                    ->alignEnd(),
                TextColumn::make('status')
                    ->label('订单状态')
                    ->badge()
                    ->formatStateUsing(fn (string $state) => self::statusLabel($state))
                    ->color(fn (string $state): string => match ($state) {
                        'pending' => 'warning',
                        'processing' => 'info',
                        'shipped' => 'primary',
                        'delivered' => 'success',
                        'cancelled' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('payment_status')
                    ->label('支付状态')
                    ->badge()
                    ->formatStateUsing(fn (string $state) => self::paymentLabel($state))
                    ->color(fn (string $state): string => match ($state) {
                        'paid' => 'success',
                        'unpaid' => 'warning',
                        'refunded' => 'gray',
                        default => 'gray',
                    }),
                TextColumn::make('payment_method')
                    ->label('支付方式')
                    ->placeholder('—')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                SelectFilter::make('status')
                    ->label('订单状态')
                    ->options([
                        'pending' => '待处理',
                        'processing' => '处理中',
                        'shipped' => '已发货',
                        'delivered' => '已送达',
                        'cancelled' => '已取消',
                    ]),
                SelectFilter::make('payment_status')
                    ->label('支付状态')
                    ->options([
                        'unpaid' => '未支付',
                        'paid' => '已支付',
                        'refunded' => '已退款',
                    ]),
                Filter::make('pending_only')
                    ->label('仅待处理')
                    ->query(fn ($query) => $query->where('status', 'pending'))
                    ->toggle(),
            ])
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function statusLabel(string $state): string
    {
        return match ($state) {
            'pending' => '待处理',
            'processing' => '处理中',
            'shipped' => '已发货',
            'delivered' => '已送达',
            'cancelled' => '已取消',
            default => $state,
        };
    }

    public static function paymentLabel(string $state): string
    {
        return match ($state) {
            'unpaid' => '未支付',
            'paid' => '已支付',
            'refunded' => '已退款',
            default => $state,
        };
    }
}
