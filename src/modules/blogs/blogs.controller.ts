import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BlogsService } from './blogs.service';
import { GeminiTranslateService } from './ai/gemini-translate.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { QueryBlogDto } from './dto/query-blog.dto';
import {
  BatchTranslateArticleDto,
  UpdateStatusDto,
} from './dto/translate.dto';
import { CreateNicheDto, UpdateNicheDto } from './dto/create-niche.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Blogs')
@Controller()
export class BlogsController {
  constructor(
    private readonly blogsService: BlogsService,
    private readonly translateService: GeminiTranslateService,
  ) {}

  // ===================== Public Endpoints =====================

  @Public()
  @Get('blogs')
  @ApiOperation({ summary: 'List published blogs with pagination, filtering and search' })
  @ApiResponse({ status: 200, description: 'Paginated list of blog articles' })
  async getPublicBlogs(@Query() query: QueryBlogDto) {
    return this.blogsService.findAll({
      ...query,
      status: query.status || ('published' as any),
    });
  }

  @Public()
  @Get('blogs/niches')
  @ApiOperation({ summary: 'List active niches / categories' })
  @ApiResponse({ status: 200, description: 'List of niches' })
  async getPublicNiches() {
    return this.blogsService.findAllNiches();
  }

  @Public()
  @Get('blogs/:slug')
  @ApiOperation({ summary: 'Get a single blog post by slug with optional translation overlay' })
  @ApiParam({ name: 'slug', description: 'Blog slug or translated slug' })
  @ApiQuery({ name: 'lang', required: false, description: 'Language code (e.g. nl, es, fr)' })
  @ApiResponse({ status: 200, description: 'Blog post details' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  async getPublicBlogBySlug(
    @Param('slug') slug: string,
    @Query('lang') lang?: string,
  ) {
    return this.blogsService.findOne(slug, lang);
  }

  @Public()
  @Post('blogs/:slug/views')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Increment blog view counter' })
  @ApiParam({ name: 'slug', description: 'Blog slug' })
  @ApiResponse({ status: 200, description: 'Updated view count' })
  async incrementView(@Param('slug') slug: string) {
    return this.blogsService.recordView(slug);
  }

  // ===================== Admin Blog Endpoints =====================

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('admin/blogs')
  @ApiOperation({ summary: 'Admin list blogs across all statuses (draft, published, unpublished)' })
  @ApiResponse({ status: 200, description: 'Paginated blog list' })
  async getAdminBlogs(@Query() query: QueryBlogDto) {
    return this.blogsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('admin/blogs')
  @ApiOperation({ summary: 'Create a new blog post' })
  @ApiResponse({ status: 201, description: 'Created blog post' })
  async createBlog(
    @Body() createBlogDto: CreateBlogDto,
    @CurrentUser() user: any,
  ) {
    return this.blogsService.create(createBlogDto, user);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('admin/blogs/:id')
  @ApiOperation({ summary: 'Get a single blog post by MongoDB ID for editing' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Blog post details' })
  @ApiResponse({ status: 404, description: 'Blog not found' })
  async getAdminBlogById(@Param('id') id: string) {
    return this.blogsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('admin/blogs/:id')
  @ApiOperation({ summary: 'Update an existing blog post' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Updated blog post' })
  async updateBlog(
    @Param('id') id: string,
    @Body() updateBlogDto: UpdateBlogDto,
  ) {
    return this.blogsService.update(id, updateBlogDto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('admin/blogs/:id')
  @ApiOperation({ summary: 'Delete a blog post' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Deletion confirmation' })
  async deleteBlog(@Param('id') id: string) {
    return this.blogsService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('admin/blogs/:id/status')
  @ApiOperation({ summary: 'Quick status change (published, draft, unpublished)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Updated status' })
  async updateBlogStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusDto,
  ) {
    return this.blogsService.updateStatus(id, body.status, body.publishDate);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('admin/blogs/:id/translations')
  @ApiOperation({ summary: 'Save translated content for a specific blog' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Updated translations' })
  async saveBlogTranslations(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    let translations = body.translations;
    if (!translations && body.lang && body.translation) {
      translations = { [body.lang]: body.translation };
    }
    const result = await this.blogsService.saveTranslations(id, translations || {});
    const blog = await this.blogsService.findOne(id);
    return {
      success: true,
      blog,
      translations: result.translations,
      supportedLanguages: result.supportedLanguages,
    };
  }

  // ===================== AI Translation Endpoints =====================

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('admin/blogs/translate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Translate article metadata, content, and FAQs into a target language using Gemini AI',
  })
  @ApiResponse({ status: 200, description: 'Translated article payload' })
  async translateArticle(@Body() dto: any) {
    if (Array.isArray(dto.toLangs) && dto.toLangs.length > 0) {
      return this.translateService.batchTranslateArticle(dto);
    }
    return this.translateService.translateArticle(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('admin/blogs/translate/batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Batch translate article into multiple target languages sequentially',
  })
  @ApiResponse({ status: 200, description: 'Batch translation map by language code' })
  async batchTranslateArticle(@Body() dto: BatchTranslateArticleDto) {
    return this.translateService.batchTranslateArticle(dto);
  }

  // ===================== Niches Management =====================

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('admin/niches')
  @ApiOperation({ summary: 'List all niches for admin management' })
  async getAdminNiches() {
    return this.blogsService.findAllNiches();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('admin/niches')
  @ApiOperation({ summary: 'Create a new niche' })
  async createNiche(@Body() dto: CreateNicheDto) {
    return this.blogsService.createNiche(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('admin/niches/:id')
  @ApiOperation({ summary: 'Update a niche' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  async updateNiche(
    @Param('id') id: string,
    @Body() dto: UpdateNicheDto,
  ) {
    return this.blogsService.updateNiche(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('admin/niches/:id')
  @ApiOperation({ summary: 'Delete a niche' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  async deleteNiche(@Param('id') id: string) {
    return this.blogsService.deleteNiche(id);
  }
}
