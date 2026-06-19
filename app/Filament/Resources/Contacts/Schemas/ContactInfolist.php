<?php

namespace App\Filament\Resources\Contacts\Schemas;

use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class ContactInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('提交人')
                    ->columns(2)
                    ->schema([
                        TextEntry::make('first_name')->label('名'),
                        TextEntry::make('last_name')->label('姓'),
                        TextEntry::make('email')
                            ->label('邮箱')
                            ->copyable()
                            ->icon('heroicon-o-envelope'),
                        TextEntry::make('phone')
                            ->label('联系电话')
                            ->placeholder('—')
                            ->copyable(),
                        TextEntry::make('company')
                            ->label('公司')
                            ->placeholder('—'),
                        TextEntry::make('inquiry_type')
                            ->label('咨询类型')
                            ->badge(),
                    ]),

                Section::make('留言内容')
                    ->schema([
                        TextEntry::make('message')
                            ->hiddenLabel()
                            ->prose()
                            ->columnSpanFull(),
                    ]),

                Section::make('处理状态')
                    ->columns(2)
                    ->schema([
                        TextEntry::make('handled_at')
                            ->label('已处理')
                            ->dateTime()
                            ->placeholder('尚未处理')
                            ->badge()
                            ->color(fn ($state) => $state ? 'success' : 'warning'),
                        TextEntry::make('created_at')
                            ->label('提交时间')
                            ->dateTime(),
                    ]),
            ]);
    }
}
