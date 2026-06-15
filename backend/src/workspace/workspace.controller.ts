import {
  Controller, Get, Post, Delete, Body, Param, UploadedFile, UseInterceptors, UseGuards, Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Express } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('projects')
  getProjects(@Request() req: any) {
    return this.workspaceService.getProjects(req.user.id);
  }

  @Delete('projects/:name')
  deleteProject(@Request() req: any, @Param('name') name: string) {
    return this.workspaceService.deleteProject(req.user.id, name);
  }

  @Post('projects/create')
  createProject(@Request() req: any, @Body('name') name: string) {
    return this.workspaceService.createProject(req.user.id, name);
  }

  @Post('projects/clone')
  cloneProject(@Request() req: any, @Body('name') name: string, @Body('repoUrl') repoUrl: string) {
    return this.workspaceService.cloneProject(req.user.id, name, repoUrl);
  }

  @Post('projects/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadProject(@Request() req: any, @Body('name') name: string, @UploadedFile() file: Express.Multer.File) {
    return this.workspaceService.extractZipProject(req.user.id, name, file.buffer);
  }

  @Get(':project/tree')
  getTree(@Request() req: any, @Param('project') project: string) {
    return this.workspaceService.getTree(req.user.id, project);
  }

  @Get(':project/file/:path')
  readFile(@Request() req: any, @Param('project') project: string, @Param('path') path: string) {
    return this.workspaceService.readFile(req.user.id, project, path);
  }

  @Post(':project/file/:path')
  writeFile(@Request() req: any, @Param('project') project: string, @Param('path') path: string, @Body('content') content: string) {
    return this.workspaceService.writeFile(req.user.id, project, path, content);
  }

  @Post(':project/create-file/:path')
  createFile(@Request() req: any, @Param('project') project: string, @Param('path') path: string) {
    return this.workspaceService.createFile(req.user.id, project, path);
  }

  @Post(':project/create-dir/:path')
  createDirectory(@Request() req: any, @Param('project') project: string, @Param('path') path: string) {
    return this.workspaceService.createDirectory(req.user.id, project, path);
  }

  @Delete(':project/path/:path')
  deletePath(@Request() req: any, @Param('project') project: string, @Param('path') path: string) {
    return this.workspaceService.deletePath(req.user.id, project, path);
  }

  @Post(':project/rename/:path')
  renamePath(@Request() req: any, @Param('project') project: string, @Param('path') path: string, @Body('newName') newName: string) {
    return this.workspaceService.renamePath(req.user.id, project, path, newName);
  }

  @Get(':project/db-files')
  findDbFiles(@Request() req: any, @Param('project') project: string) {
    return this.workspaceService.findDbFiles(req.user.id, project);
  }

  @Get(':project/detect-run')
  detectRunCommand(@Request() req: any, @Param('project') project: string) {
    return this.workspaceService.detectRunCommand(req.user.id, project) ?? { command: null, label: null };
  }

  @Get('launch-config')
  getGlobalLaunchConfig() {
    return this.workspaceService.getGlobalLaunchConfig();
  }
}
