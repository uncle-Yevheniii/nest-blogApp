import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccessUserDto, CreateUserDto } from './dto';
import { hash, verify } from 'argon2';
import { Tokens } from './types';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async findUserByEmail(email: string) {
    return this.prismaService.users.findUnique({ where: { email } });
  }

  async findUserByIdAndUpdateRt(id: number, rt: string) {
    return this.prismaService.users.update({ where: { id }, data: { hashRt: rt } });
  }

  async hashData(data: string): Promise<string> {
    return await hash(data);
  }

  async matchData(hash: string, data: string): Promise<boolean> {
    return await verify(hash, data);
  }

  async signToken(userID: number, email: string): Promise<Tokens> {
    const [at, rt] = await Promise.all([
      this.jwtService.signAsync({ sub: userID, email }, { expiresIn: '15m', secret: 'at-secret' }),
      this.jwtService.signAsync({ sub: userID, email }, { expiresIn: '7d', secret: 'rt-secret' }),
    ]);

    return { accessToken: at, refreshToken: rt };
  }

  async updateRtHash(userID: number, rt: string): Promise<void> {
    const hashRt = await this.hashData(rt);
    await this.findUserByIdAndUpdateRt(userID, hashRt);
  }

  async signupLocalUser(dto: CreateUserDto): Promise<Tokens> {
    const userExists = await this.findUserByEmail(dto.email);
    if (userExists) throw new ConflictException('Credential already exists');

    const { password, ...userInfo } = dto;
    const hashPwd = await this.hashData(password);

    const user = await this.prismaService.users.create({
      data: { hashPwd, ...userInfo },
    });

    const tokens = await this.signToken(user.id, user.email);
    await this.updateRtHash(user.id, tokens.refreshToken);

    return tokens;
  }

  async signinLocalUser(dto: AccessUserDto): Promise<Tokens> {
    console.log(dto);
    const user = await this.findUserByEmail(dto.email);
    if (!user) throw new BadRequestException('Credentials are invalid');

    const isMatch = await this.matchData(user.hashPwd, dto.password);
    if (!isMatch) throw new BadRequestException('Credentials are invalid');

    const tokens = await this.signToken(user.id, user.email);
    await this.updateRtHash(user.id, tokens.refreshToken);

    return tokens;
  }
  async logout() {}
  async refresh() {}
}
