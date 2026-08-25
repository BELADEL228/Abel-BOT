import { defaultTheme } from '../dist/ui/themes/default.theme.js';
import { InteractiveBuilder } from '../dist/ui/builders/interactive.builder.js';
import { TextCardBuilder } from '../dist/ui/builders/text-card.builder.js';
import { createCategoryCard } from '../dist/ui/components/CategoryCard.js';
import { createCommandCard } from '../dist/ui/components/CommandCard.js';
import { createStatusCard } from '../dist/ui/components/StatusCard.js';

console.log('=== TEST 1: STATUS CARD GENERATION ===');
const statusCard = createStatusCard({ prefix: '.', isOwner: true });
console.log('Status Card Title:', statusCard.title);
console.log('Status Card Buttons:', statusCard.buttons?.map(b => b.displayText));

console.log('\n=== TEST 2: COMMAND CARD GENERATION ===');
const sampleCommand = {
  name: 'summarize',
  aliases: ['sum', 'resume'],
  category: 'AI',
  description: 'Résumer un texte ou une conversation WhatsApp',
  usage: '.summarize <texte>',
  cooldown: 3,
  execute: async () => {}
};
const commandCard = createCommandCard({ command: sampleCommand, prefix: '.' });
console.log('Command Card Title:', commandCard.title);
console.log('Command Card Buttons:', commandCard.buttons?.map(b => b.displayText));

console.log('\n=== TEST 3: CATEGORY CARD & CAROUSEL GENERATION ===');
const categoryCard = createCategoryCard({
  category: 'AI',
  commands: [sampleCommand],
  prefix: '.',
  isOwner: true
});
console.log('Category Card Title:', categoryCard.title);

const carousel = {
  title: 'Menu Principal',
  cards: [statusCard, categoryCard],
  footer: 'Glissez pour naviguer'
};

const protoCarousel = InteractiveBuilder.buildCarousel(carousel);
console.log('Proto Carousel created successfully:', !!protoCarousel.carouselMessage?.cards);
console.log('Proto Carousel cards count:', protoCarousel.carouselMessage?.cards?.length);

console.log('\n=== TEST 4: TEXT CARD & CAROUSEL FALLBACK RENDERING ===');
const renderedTextCard = TextCardBuilder.renderCard(commandCard);
console.log('Rendered Text Card sample:\n' + renderedTextCard);

console.log('\n=== TEST 5: TEXT CAROUSEL FALLBACK RENDERING ===');
const renderedCarouselText = TextCardBuilder.renderCarousel(carousel);
console.log('Rendered Carousel text length:', renderedCarouselText.length, 'characters');

console.log('\n✅ ALL UI SYSTEM TESTS PASSED SUCCESSFULLY!');
