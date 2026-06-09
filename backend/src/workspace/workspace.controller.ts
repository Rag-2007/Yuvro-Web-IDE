import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorkspaceService } from './workspace.service';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('projects')
  getProjects() {
    return this.workspaceService.getProjects();
  }

  @Delete('projects/:name')
  deleteProject(@Param('name') name: string) {
    return this.workspaceService.deleteProject(name);
  }

  @Post('projects/create')
  createProject(@Body('name') name: string) {
    return this.workspaceService.createProject(name);
  }

  @Post('projects/clone')
  cloneProject(@Body('name') name: string, @Body('repoUrl') repoUrl: string) {
    return this.workspaceService.cloneProject(name, repoUrl);
  }

  @Post('projects/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadProject(
    @Body('name') name: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.workspaceService.extractZipProject(name, file.buffer);
  }

  @Get(':project/tree')
  getTree(@Param('project') project: string) {
    return this.workspaceService.getTree(project);
  }

  @Get(':project/file/:path')
  readFile(@Param('project') project: string, @Param('path') path: string) {
    return this.workspaceService.readFile(project, path);
  }

  @Post(':project/file/:path')
  writeFile(
    @Param('project') project: string,
    @Param('path') path: string,
    @Body('content') content: string,
  ) {
    return this.workspaceService.writeFile(project, path, content);
  }

  @Post(':project/create-file/:path')
  createFile(@Param('project') project: string, @Param('path') path: string) {
    return this.workspaceService.createFile(project, path);
  }

  @Post(':project/create-dir/:path')
  createDirectory(
    @Param('project') project: string,
    @Param('path') path: string,
  ) {
    return this.workspaceService.createDirectory(project, path);
  }

  @Delete(':project/path/:path')
  deletePath(@Param('project') project: string, @Param('path') path: string) {
    return this.workspaceService.deletePath(project, path);
  }

  @Post(':project/rename/:path')
  renamePath(
    @Param('project') project: string,
    @Param('path') path: string,
    @Body('newName') newName: string,
  ) {
    return this.workspaceService.renamePath(project, path, newName);
  }

  @Get(':project/db-files')
  findDbFiles(@Param('project') project: string) {
    return this.workspaceService.findDbFiles(project);
  }

  @Get(':project/detect-run')
  detectRunCommand(@Param('project') project: string) {
    return this.workspaceService.detectRunCommand(project) ?? { command: null, label: null };
  }

  @Get('launch-config')
  getGlobalLaunchConfig() {
    return this.workspaceService.getGlobalLaunchConfig();
  }
}
