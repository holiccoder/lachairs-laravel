<?php

namespace App\Filament\Resources\Users\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class UsersTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('first_name')
                    ->label('姓名')
                    ->formatStateUsing(fn ($record): string => trim(($record->first_name ?? '').' '.($record->last_name ?? '')) ?: '—')
                    ->searchable(['first_name', 'last_name'])
                    ->sortable(),
                TextColumn::make('email')
                    ->label('邮箱地址')
                    ->searchable()
                    ->sortable()
                    ->copyable(),
                TextColumn::make('company.name')
                    ->label('公司')
                    ->placeholder('—')
                    ->searchable()
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('job_title')
                    ->label('职位')
                    ->placeholder('—')
                    ->toggleable(),
                TextColumn::make('phone')
                    ->label('联系电话')
                    ->placeholder('—')
                    ->toggleable(),
                IconColumn::make('email_verified_at')
                    ->label('已验证')
                    ->boolean()
                    ->getStateUsing(fn ($record): bool => $record->email_verified_at !== null),
                TextColumn::make('email_verified_at')
                    ->label('验证时间')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('created_at')
                    ->label('创建时间')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                SelectFilter::make('company_id')
                    ->label('公司')
                    ->relationship('company', 'name')
                    ->searchable()
                    ->preload(),
                TernaryFilter::make('email_verified_at')
                    ->label('邮箱验证')
                    ->nullable()
                    ->placeholder('全部用户')
                    ->trueLabel('已验证')
                    ->falseLabel('未验证'),
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
