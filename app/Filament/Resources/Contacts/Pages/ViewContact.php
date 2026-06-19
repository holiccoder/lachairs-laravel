<?php

namespace App\Filament\Resources\Contacts\Pages;

use App\Filament\Resources\Contacts\ContactResource;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\ViewRecord;

class ViewContact extends ViewRecord
{
    protected static string $resource = ContactResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('toggleHandled')
                ->label(fn () => $this->record->handled_at ? '标记为未处理' : '标记为已处理')
                ->icon(fn () => $this->record->handled_at ? 'heroicon-o-arrow-uturn-left' : 'heroicon-o-check')
                ->color(fn () => $this->record->handled_at ? 'gray' : 'success')
                ->action(function () {
                    $this->record->update([
                        'handled_at' => $this->record->handled_at ? null : now(),
                    ]);
                    $this->refreshFormData(['handled_at']);
                }),
            DeleteAction::make(),
        ];
    }
}
