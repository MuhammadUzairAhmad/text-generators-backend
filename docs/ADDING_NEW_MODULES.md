# Developer Guide: How to Add New Modules

Follow this standard checklist whenever adding a new feature or domain module to the backend.

---

## Step 1: Generate Module Scaffolding
Use the NestJS CLI inside the project directory:

```bash
# Generate the module, controller, and service
nest g module modules/my-feature
nest g controller modules/my-feature
nest g service modules/my-feature
```

---

## Step 2: Define Mongoose Schema (if Database is needed)
Create `src/modules/my-feature/schemas/my-feature.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MyFeatureDocument = MyFeature & Document;

@Schema({ timestamps: true })
export class MyFeature {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const MyFeatureSchema = SchemaFactory.createForClass(MyFeature);
```

Register the schema in `my-feature.module.ts`:
```typescript
MongooseModule.forFeature([{ name: MyFeature.name, schema: MyFeatureSchema }])
```

---

## Step 3: Create Data Transfer Objects (DTOs)
Create `src/modules/my-feature/dto/create-my-feature.dto.ts`:

```typescript
import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMyFeatureDto {
  @ApiProperty({ description: 'Title of the item', example: 'New Feature' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Active status', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
```

---

## Step 4: Decorate Controller with Swagger
In `my-feature.controller.ts`:

```typescript
import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MyFeatureService } from './my-feature.service';
import { CreateMyFeatureDto } from './dto/create-my-feature.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('My Feature')
@Controller('my-feature')
export class MyFeatureController {
  constructor(private readonly service: MyFeatureService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create a new feature item' })
  @ApiResponse({ status: 201, description: 'Created successfully' })
  create(@Body() dto: CreateMyFeatureDto) {
    return this.service.create(dto);
  }
}
```

---

## Step 5: Update Living Documentation
1. Add the new routes to `docs/API_SPEC.md`.
2. Open `http://localhost:4000/docs` in your browser to verify and test the new endpoint interactively!
