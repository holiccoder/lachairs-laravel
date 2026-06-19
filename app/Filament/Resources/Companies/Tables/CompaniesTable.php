<?php

namespace App\Filament\Resources\Companies\Tables;

use App\Filament\Resources\Companies\Schemas\CompanyForm;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class CompaniesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name')
                    ->label('公司名称')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('business_type')
                    ->label('业务类型')
                    ->placeholder('—')
                    ->formatStateUsing(fn (?string $state): ?string => $state ? (CompanyForm::BUSINESS_TYPES[$state] ?? $state) : null)
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('city')
                    ->label('城市')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('state')
                    ->label('州 / 省')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('phone')
                    ->label('联系电话')
                    ->toggleable(),
                TextColumn::make('users_count')
                    ->label('用户数')
                    ->counts('users')
                    ->sortable(),
                TextColumn::make('status')
                    ->label('状态')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => CompanyForm::STATUSES[$state] ?? $state)
                    ->color(fn (string $state): string => match ($state) {
                        'approved' => 'success',
                        'rejected' => 'danger',
                        default => 'warning',
                    })
                    ->sortable(),
                TextColumn::make('created_at')
                    ->label('创建时间')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                SelectFilter::make('status')
                    ->label('状态')
                    ->options(CompanyForm::STATUSES),
                SelectFilter::make('business_type')
                    ->label('业务类型')
                    ->options(CompanyForm::BUSINESS_TYPES)
                    ->searchable(),
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
