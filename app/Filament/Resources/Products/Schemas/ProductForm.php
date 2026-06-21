<?php

namespace App\Filament\Resources\Products\Schemas;

use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TagsInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Schema;
use Illuminate\Support\Str;

class ProductForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Tabs::make('商品')
                    ->columnSpanFull()
                    ->tabs([
                        Tab::make('详情')
                            ->icon('heroicon-o-information-circle')
                            ->schema([
                                Section::make('基本信息')
                                    ->columns(2)
                                    ->schema([
                                        TextInput::make('name')
                                            ->label('商品名称')
                                            ->required()
                                            ->maxLength(255)
                                            ->live(onBlur: true)
                                            ->afterStateUpdated(function (string $operation, ?string $state, callable $set): void {
                                                if ($operation !== 'create' || blank($state)) {
                                                    return;
                                                }
                                                $set('slug', Str::slug($state));
                                            })
                                            ->columnSpanFull(),
                                        TextInput::make('slug')
                                            ->label('URL 别名')
                                            ->required()
                                            ->maxLength(255)
                                            ->unique(ignoreRecord: true),
                                        TextInput::make('sku')
                                            ->label('商品编码')
                                            ->required()
                                            ->maxLength(255)
                                            ->unique(ignoreRecord: true),
                                        Select::make('product_category_id')
                                            ->label('主分类')
                                            ->helperText('用作面包屑和规范 URL 的主分类。')
                                            ->relationship('category', 'name')
                                            ->searchable()
                                            ->preload()
                                            ->required(),
                                        Select::make('categories')
                                            ->label('其他分类')
                                            ->helperText('商品也会出现在这些分类的列表页中。无需重复添加主分类——保存时会自动加入。')
                                            ->relationship('categories', 'name')
                                            ->multiple()
                                            ->searchable()
                                            ->preload()
                                            // Always re-add the primary category to whatever the user
                                            // picked here, so cards stay reachable from the canonical
                                            // URL even when an editor only sets cross-listings.
                                            ->saveRelationshipsUsing(function ($state, $record): void {
                                                $ids = collect((array) $state)
                                                    ->filter()
                                                    ->map(fn ($v) => (int) $v);
                                                if ($record->product_category_id) {
                                                    $ids->push((int) $record->product_category_id);
                                                }
                                                $record->categories()->sync($ids->unique()->values()->all());
                                            }),
                                        TextInput::make('brand')
                                            ->label('品牌')
                                            ->default('Lachairs')
                                            ->maxLength(255),
                                        TextInput::make('default_color')
                                            ->label('默认颜色')
                                            ->maxLength(255),
                                        TextInput::make('price')
                                            ->label('价格')
                                            ->numeric()
                                            ->prefix('$')
                                            ->step('0.01')
                                            ->nullable(),
                                        TextInput::make('stock')
                                            ->label('库存')
                                            ->numeric()
                                            ->integer()
                                            ->default(100)
                                            ->required(),
                                        Toggle::make('is_active')
                                            ->label('上架中')
                                            ->default(true)
                                            ->columnSpanFull(),
                                    ]),

                                Section::make('描述')
                                    ->schema([
                                        Textarea::make('description')
                                            ->label('商品描述')
                                            ->rows(4)
                                            ->maxLength(2000)
                                            ->columnSpanFull(),
                                    ]),
                            ]),

                        Tab::make('图片')
                            ->icon('heroicon-o-photo')
                            ->schema([
                                Section::make('主图')
                                    ->description('保存到 public/images/products/，通过 /images/products/ 直接访问（无需 storage:link）。')
                                    ->schema([
                                        FileUpload::make('image')
                                            ->label('主图')
                                            ->image()
                                            ->disk('public_root')
                                            ->directory('images/products')
                                            ->visibility('public')
                                            ->maxSize(5120)
                                            ->columnSpanFull(),
                                    ]),

                                Section::make('图库')
                                    ->description('额外的图库图片，保存到 public/images/products/，通过 /images/products/ 直接访问。')
                                    ->schema([
                                        FileUpload::make('gallery')
                                            ->label('图库')
                                            ->multiple()
                                            ->image()
                                            ->reorderable()
                                            ->appendFiles()
                                            ->panelLayout('grid')
                                            ->disk('public_root')
                                            ->directory('images/products')
                                            ->visibility('public')
                                            ->maxSize(5120)
                                            ->columnSpanFull(),
                                    ]),
                            ]),

                        Tab::make('特性与规格')
                            ->icon('heroicon-o-list-bullet')
                            ->schema([
                                Section::make('特性')
                                    ->description('每行一条要点。')
                                    ->schema([
                                        TagsInput::make('features')
                                            ->label('特性')
                                            ->placeholder('添加一项特性')
                                            ->columnSpanFull(),
                                    ]),

                                Section::make('规格参数')
                                    ->schema([
                                        KeyValue::make('specifications')
                                            ->label('规格参数')
                                            ->keyLabel('参数名')
                                            ->valueLabel('参数值')
                                            ->reorderable()
                                            ->columnSpanFull(),
                                    ]),
                            ]),

                        Tab::make('常见问题')
                            ->icon('heroicon-o-question-mark-circle')
                            ->schema([
                                Repeater::make('faq')
                                    ->label('常见问题')
                                    ->schema([
                                        TextInput::make('question')
                                            ->label('问题')
                                            ->required()
                                            ->maxLength(500),
                                        Textarea::make('answer')
                                            ->label('答案')
                                            ->required()
                                            ->rows(3)
                                            ->maxLength(2000),
                                    ])
                                    ->itemLabel(fn (array $state): ?string => $state['question'] ?? null)
                                    ->collapsed()
                                    ->reorderable()
                                    ->cloneable()
                                    ->columnSpanFull(),
                            ]),

                        Tab::make('颜色款式')
                            ->icon('heroicon-o-swatch')
                            ->schema([
                                Repeater::make('color_variants')
                                    ->label('款式')
                                    ->schema([
                                        TextInput::make('label')
                                            ->label('款式名称')
                                            ->required()
                                            ->maxLength(255),
                                        TextInput::make('swatch')
                                            ->label('色块（十六进制或图片路径）')
                                            ->placeholder('#ffffff 或 images/products/foo/swatch.png')
                                            ->maxLength(255),
                                        FileUpload::make('gallery')
                                            ->label('图库')
                                            ->multiple()
                                            ->image()
                                            ->reorderable()
                                            ->appendFiles()
                                            ->panelLayout('grid')
                                            ->disk('public_root')
                                            ->directory('images/products')
                                            ->visibility('public')
                                            ->maxSize(5120)
                                            ->columnSpanFull(),
                                    ])
                                    ->itemLabel(fn (array $state): ?string => $state['label'] ?? null)
                                    ->collapsed()
                                    ->reorderable()
                                    ->cloneable()
                                    ->columnSpanFull(),
                            ]),
                    ]),
            ]);
    }
}
