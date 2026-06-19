<?php

namespace App\Filament\Resources\Orders\Schemas;

use App\Filament\Resources\Orders\Tables\OrdersTable;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class OrderInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('订单信息')
                    ->columns(3)
                    ->schema([
                        TextEntry::make('order_number')
                            ->label('订单号')
                            ->copyable()
                            ->weight('medium'),
                        TextEntry::make('created_at')
                            ->label('下单时间')
                            ->dateTime('Y-m-d H:i'),
                        TextEntry::make('updated_at')
                            ->label('最近更新')
                            ->dateTime('Y-m-d H:i'),
                        TextEntry::make('status')
                            ->label('订单状态')
                            ->badge()
                            ->formatStateUsing(fn (string $state) => OrdersTable::statusLabel($state))
                            ->color(fn (string $state): string => match ($state) {
                                'pending' => 'warning',
                                'processing' => 'info',
                                'shipped' => 'primary',
                                'delivered' => 'success',
                                'cancelled' => 'danger',
                                default => 'gray',
                            }),
                        TextEntry::make('payment_status')
                            ->label('支付状态')
                            ->badge()
                            ->formatStateUsing(fn (string $state) => OrdersTable::paymentLabel($state))
                            ->color(fn (string $state): string => match ($state) {
                                'paid' => 'success',
                                'unpaid' => 'warning',
                                'refunded' => 'gray',
                                default => 'gray',
                            }),
                        TextEntry::make('payment_method')
                            ->label('支付方式')
                            ->placeholder('—'),
                    ]),

                Section::make('客户信息')
                    ->columns(3)
                    ->schema([
                        TextEntry::make('customer_name')
                            ->label('客户姓名'),
                        TextEntry::make('customer_email')
                            ->label('邮箱')
                            ->copyable()
                            ->icon('heroicon-o-envelope'),
                        TextEntry::make('customer_phone')
                            ->label('联系电话')
                            ->placeholder('—')
                            ->copyable(),
                        TextEntry::make('user.email')
                            ->label('账户')
                            ->placeholder('游客下单')
                            ->columnSpanFull(),
                    ]),

                Section::make('收货地址')
                    ->schema([
                        TextEntry::make('shipping_address')
                            ->hiddenLabel()
                            ->prose()
                            ->columnSpanFull(),
                    ]),

                Section::make('费用明细')
                    ->columns(4)
                    ->schema([
                        TextEntry::make('subtotal')
                            ->label('小计')
                            ->money('USD'),
                        TextEntry::make('tax')
                            ->label('税费')
                            ->money('USD'),
                        TextEntry::make('shipping_fee')
                            ->label('运费')
                            ->money('USD'),
                        TextEntry::make('total')
                            ->label('总金额')
                            ->money('USD')
                            ->weight('bold'),
                    ]),

                Section::make('备注')
                    ->visible(fn ($record) => filled($record->notes))
                    ->schema([
                        TextEntry::make('notes')
                            ->hiddenLabel()
                            ->prose()
                            ->columnSpanFull(),
                    ]),
            ]);
    }
}
