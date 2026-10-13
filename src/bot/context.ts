import { AppConfig } from '../config';
import { Repository } from '../domain/types';
import { LinkService } from '../services/linkService';
import { SessionService } from '../services/sessionService';

export interface BotContext {
  repo: Repository;
  sessions: SessionService;
  links: LinkService;
  config: AppConfig;
}
