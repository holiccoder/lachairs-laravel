<?php

namespace App\Filament\Resources\Users\Schemas;

use App\Models\Company;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Illuminate\Support\Facades\Hash;

class UserForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('账户信息')
                    ->columns(2)
                    ->schema([
                        Select::make('company_id')
                            ->label('所属公司')
                            ->relationship('company', 'name')
                            ->searchable()
                            ->preload()
                            ->createOptionForm([
                                TextInput::make('name')->label('公司名称')->required()->maxLength(255),
                                TextInput::make('street_address')->label('街道地址')->required()->maxLength(255),
                                TextInput::make('city')->label('城市')->required()->maxLength(255),
                                TextInput::make('state')->label('州 / 省')->required()->maxLength(64),
                                TextInput::make('zip')->label('邮编')->required()->maxLength(32),
                                TextInput::make('phone')->label('联系电话')->required()->tel()->maxLength(32),
                            ])
                            ->createOptionUsing(fn (array $data): int => Company::create($data)->getKey())
                            ->columnSpanFull()
                            ->nullable(),
                        TextInput::make('first_name')
                            ->label('名')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('last_name')
                            ->label('姓')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('job_title')
                            ->label('职位')
                            ->maxLength(255),
                        TextInput::make('phone')
                            ->label('联系电话')
                            ->tel()
                            ->maxLength(32),
                        TextInput::make('email')
                            ->label('邮箱地址')
                            ->email()
                            ->required()
                            ->maxLength(255)
                            ->unique(ignoreRecord: true)
                            ->columnSpanFull(),
                        DateTimePicker::make('email_verified_at')
                            ->label('邮箱验证时间')
                            ->seconds(false),
                    ]),

                Section::make('密码')
                    ->columns(2)
                    ->description('留空则保留原密码。')
                    ->schema([
                        TextInput::make('password')
                            ->label('密码')
                            ->password()
                            ->revealable()
                            ->confirmed()
                            ->minLength(8)
                            ->required(fn (string $operation): bool => $operation === 'create')
                            ->dehydrated(fn (?string $state): bool => filled($state))
                            ->dehydrateStateUsing(fn (string $state): string => Hash::make($state))
                            ->autocomplete('new-password'),
                        TextInput::make('password_confirmation')
                            ->label('确认密码')
                            ->password()
                            ->revealable()
                            ->minLength(8)
                            ->required(fn (string $operation, $get): bool => $operation === 'create' || filled($get('password')))
                            ->dehydrated(false)
                            ->autocomplete('new-password'),
                    ]),
            ]);
    }
}
