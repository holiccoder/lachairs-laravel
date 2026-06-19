<?php

namespace App\Filament\Resources\Orders\Schemas;

use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class OrderForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('订单状态')
                    ->columns(3)
                    ->schema([
                        Select::make('status')
                            ->label('订单状态')
                            ->options([
                                'pending' => '待处理',
                                'processing' => '处理中',
                                'shipped' => '已发货',
                                'delivered' => '已送达',
                                'cancelled' => '已取消',
                            ])
                            ->required()
                            ->native(false),
                        Select::make('payment_status')
                            ->label('支付状态')
                            ->options([
                                'unpaid' => '未支付',
                                'paid' => '已支付',
                                'refunded' => '已退款',
                            ])
                            ->required()
                            ->native(false),
                        TextInput::make('payment_method')
                            ->label('支付方式')
                            ->maxLength(255)
                            ->placeholder('—'),
                    ]),

                Section::make('客户信息')
                    ->columns(3)
                    ->schema([
                        TextInput::make('customer_name')
                            ->label('客户姓名')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('customer_email')
                            ->label('邮箱')
                            ->required()
                            ->email()
                            ->maxLength(255),
                        TextInput::make('customer_phone')
                            ->label('联系电话')
                            ->tel()
                            ->maxLength(255),
                    ]),

                Section::make('收货地址')
                    ->schema([
                        Textarea::make('shipping_address')
                            ->hiddenLabel()
                            ->required()
                            ->rows(4)
                            ->columnSpanFull(),
                    ]),

                Section::make('备注')
                    ->schema([
                        Textarea::make('notes')
                            ->hiddenLabel()
                            ->rows(3)
                            ->columnSpanFull()
                            ->placeholder('内部备注（仅后台可见）'),
                    ]),
            ]);
    }
}
