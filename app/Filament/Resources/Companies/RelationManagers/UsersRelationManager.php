<?php

namespace App\Filament\Resources\Companies\RelationManagers;

use App\Filament\Resources\Users\Schemas\UserForm;
use App\Filament\Resources\Users\Tables\UsersTable;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class UsersRelationManager extends RelationManager
{
    protected static string $relationship = 'users';

    protected static ?string $title = '员工用户';

    public function form(Schema $schema): Schema
    {
        return UserForm::configure($schema);
    }

    public function table(Table $table): Table
    {
        $configured = UsersTable::configure($table);

        // Hide the company column inside the relation manager — it's redundant here.
        return $configured->recordTitleAttribute('first_name');
    }
}
