import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Promotions } from 'generated-entities/entities/Promotions';

export type PromotionsListItem = {
  promotion_id: string;
  title: string;
  description: string | null;
  category: string | null;
  rating: string | null;
  image_url: string | null;
  club_address: string | null;
  club: string | null;
};

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotions)
    private readonly promotionsRepository: Repository<Promotions>,
  ) {}

  async findAll(): Promise<PromotionsListItem[]> {
    const promotions = await this.promotionsRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.club', 'club')
      .where(
        new Brackets((qb) => {
          qb.where('p.valid_until IS NULL').orWhere('p.valid_until >= :now', {
            now: new Date(),
          });
        }),
      )
      .orderBy('p.valid_until', 'ASC', 'NULLS LAST')
      .addOrderBy('p.promotion_id', 'ASC')
      .getMany();
  
    return promotions.map((promotions) => this.toListItem(promotions));
  }
  create(promotionsData: Partial<Promotions>): Promise<Promotions> {
    const promotions = this.promotionsRepository.create(promotionsData);
    return this.promotionsRepository.save(promotions);
  }

  private toListItem(promotions: Promotions): PromotionsListItem {
    return {
        promotion_id: promotions.promotionId,
        title: promotions.title,
        description: promotions.description,
        category: promotions.category,
        rating: promotions.rating,
        image_url: promotions.imageUrl,
        club_address: promotions.club?.clubAddress ?? null,
        club: promotions.club?.clubName ?? null,
    };
  }
}
