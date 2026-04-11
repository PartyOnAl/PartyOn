import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clubs } from 'generated-entities/entities/Clubs';

export type ClubsListItem = {
  club_name: string;
  club_image: string | null;
};

@Injectable()
export class ClubsService {
  constructor(
    @InjectRepository(Clubs)
    private readonly clubsRepository: Repository<Clubs>,
  ) {}

  async findAll(): Promise<ClubsListItem[]> {
  
    const clubs = await this.clubsRepository.find({
    });
  
    return clubs.map((clubs) => this.toListItem(clubs));
  }
  create(clubsData: Partial<Clubs>): Promise<Clubs> {
    const clubs = this.clubsRepository.create(clubsData);
    return this.clubsRepository.save(clubs);
  }

  private toListItem(clubs: Clubs): ClubsListItem {
    return {
      club_name: clubs.clubName,
      club_image: clubs.clubImage,
    };
  }
}
