import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { UserService } from './user.service';

class CreateUserDto {
  id: string;
  name: string;
  publicKey: string;
}

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() body: CreateUserDto) {
    const { id, name, publicKey } = body;
    return await this.userService.createUser({ id, name, publicKey });
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return await this.userService.getUserById(id);
  }

  @Get('public/:publicKey')
  async getUserByPublicKey(@Param('publicKey') publicKey: string) {
    return await this.userService.getUserByPublicKey(publicKey);
  }

  @Get('name/:name')
  async getUserByName(@Param('name') name: string) {
    return await this.userService.getUserByName(name);
  }
}
