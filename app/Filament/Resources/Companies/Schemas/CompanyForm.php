<?php

namespace App\Filament\Resources\Companies\Schemas;

use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class CompanyForm
{
    /**
     * Mirrors the options shown on the public /register page.
     */
    public const BUSINESS_TYPES = [
        'Event Rental Company' => '活动租赁公司',
        'Hospitality / Hotel' => '酒店 / 接待业',
        'Venue / Convention Center' => '场地 / 会议中心',
        'Interior Design Firm' => '室内设计公司',
        'Restaurant / Catering' => '餐饮 / 宴会',
        'Educational Institution' => '教育机构',
        'Government / Military' => '政府 / 军方',
        'Religious Organization' => '宗教组织',
        'Reseller / Distributor' => '经销商 / 分销商',
        'Other' => '其他',
    ];

    public const COUNTRIES = [
        'United States' => '美国',
        'Canada' => '加拿大',
    ];

    public const STATUSES = [
        'pending' => '待审核',
        'approved' => '已通过',
        'rejected' => '已驳回',
    ];

    public const US_STATES = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    ];

    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('公司信息')
                    ->columns(2)
                    ->schema([
                        TextInput::make('name')
                            ->label('公司名称')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('legal_name')
                            ->label('公司法定名称')
                            ->maxLength(255),
                        Select::make('business_type')
                            ->label('业务类型')
                            ->options(self::BUSINESS_TYPES)
                            ->searchable()
                            ->nullable(),
                        TextInput::make('vat_tax_id')
                            ->label('税号 / VAT')
                            ->maxLength(255),
                        TextInput::make('reseller_id')
                            ->label('经销商编号')
                            ->maxLength(255),
                        Select::make('status')
                            ->label('状态')
                            ->options(self::STATUSES)
                            ->required()
                            ->default('pending')
                            ->native(false),
                    ]),

                Section::make('注册地址')
                    ->columns(2)
                    ->schema([
                        TextInput::make('street_address')
                            ->label('街道地址')
                            ->required()
                            ->maxLength(255)
                            ->columnSpanFull(),
                        TextInput::make('street_address_2')
                            ->label('地址第二行')
                            ->placeholder('套间 / 楼层等')
                            ->maxLength(255)
                            ->columnSpanFull(),
                        TextInput::make('city')
                            ->label('城市')
                            ->required()
                            ->maxLength(255),
                        Select::make('state')
                            ->label('州 / 省')
                            ->options(array_combine(self::US_STATES, self::US_STATES))
                            ->searchable()
                            ->required(),
                        TextInput::make('zip')
                            ->label('邮编')
                            ->required()
                            ->maxLength(32),
                        Select::make('country')
                            ->label('国家')
                            ->options(self::COUNTRIES)
                            ->required()
                            ->default('United States')
                            ->native(false),
                        TextInput::make('phone')
                            ->label('联系电话')
                            ->tel()
                            ->required()
                            ->placeholder('(555) 000-0000')
                            ->maxLength(32)
                            ->columnSpanFull(),
                    ]),
            ]);
    }
}
