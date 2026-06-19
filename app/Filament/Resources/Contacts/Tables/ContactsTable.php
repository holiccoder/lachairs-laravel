<?php

namespace App\Filament\Resources\Contacts\Tables;

use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class ContactsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('created_at')
                    ->label('提交时间')
                    ->dateTime('Y-m-d H:i')
                    ->sortable(),
                TextColumn::make('full_name')
                    ->label('姓名')
                    ->searchable(['first_name', 'last_name']),
                TextColumn::make('email')
                    ->label('邮箱')
                    ->searchable()
                    ->copyable()
                    ->icon('heroicon-o-envelope'),
                TextColumn::make('inquiry_type')
                    ->label('咨询类型')
                    ->badge()
                    ->searchable(),
                TextColumn::make('company')
                    ->label('公司')
                    ->searchable()
                    ->placeholder('—')
                    ->toggleable(),
                TextColumn::make('phone')
                    ->label('联系电话')
                    ->placeholder('—')
                    ->toggleable(isToggledHiddenByDefault: true),
                IconColumn::make('handled_at')
                    ->label('已处理')
                    ->boolean()
                    ->trueIcon('heroicon-o-check-circle')
                    ->falseIcon('heroicon-o-clock')
                    ->trueColor('success')
                    ->falseColor('warning'),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                SelectFilter::make('inquiry_type')
                    ->label('咨询类型')
                    ->options(fn () => \App\Models\Contact::query()
                        ->select('inquiry_type')
                        ->distinct()
                        ->pluck('inquiry_type', 'inquiry_type')
                        ->all()),
                Filter::make('unhandled')
                    ->label('仅未处理')
                    ->query(fn ($query) => $query->whereNull('handled_at'))
                    ->toggle(),
            ])
            ->recordActions([
                ViewAction::make(),
                Action::make('toggleHandled')
                    ->label(fn ($record) => $record->handled_at ? '标记为未处理' : '标记为已处理')
                    ->icon(fn ($record) => $record->handled_at ? 'heroicon-o-arrow-uturn-left' : 'heroicon-o-check')
                    ->color(fn ($record) => $record->handled_at ? 'gray' : 'success')
                    ->action(function ($record) {
                        $record->update([
                            'handled_at' => $record->handled_at ? null : now(),
                        ]);
                    }),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
