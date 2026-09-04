import cardSpace from "@/assets/card-space.jpg";
import cardDogs from "@/assets/card-dogs.jpg";
import cardTrees from "@/assets/card-trees.jpg";

export type Story = {
  slug: string;
  image: string;
  title: string;
  description: string;
  minutes: number;
  likes: number;
  tint: string;
  category: string;
  date: string;
  paragraphs: string[];
  funFact: string;
  edition?: string;
};

export const stories: Story[] = [
  {
    slug: "the-amazing-world-of-space",
    image: cardSpace,
    title: "The Amazing World of Space",
    description: "Explore the planets, stars, and galaxies beyond our world.",
    minutes: 5,
    likes: 254,
    tint: "bg-grape/15",
    category: "Science",
    date: "Aug 26, 2025",
    edition: "Aug 26, 2025",
    paragraphs: [
      "Space is a vast and mysterious place. It's filled with planets, stars, galaxies and so much more! Our solar system has 8 planets, and Earth is the only known place with life. Scientists are still discovering new things every day.",
      "One of the most amazing things about space is that it helps us understand our world better. By studying the stars and planets, we learn about the history of the universe and our place in it.",
      "Astronauts travel to space in rockets and live on the International Space Station, where everything floats — even their food and water droplets!",
    ],
    funFact: "A day on Venus is longer than a year on Venus!",
  },
  {
    slug: "why-dogs-are-mans-best-friends",
    image: cardDogs,
    title: "Why Dogs Are Man's Best Friends",
    description: "Learn how dogs help us and why they make us happy.",
    minutes: 4,
    likes: 189,
    tint: "bg-secondary/30",
    category: "Animals",
    date: "Aug 20, 2025",
    edition: "Sep 26, 2025",
    paragraphs: [
      "Dogs have lived with people for more than 15,000 years. They were the very first animal that humans became friends with, and they have been helping us ever since.",
      "Dogs can guide people who cannot see, sniff out things that are lost, and even tell when their human friend is feeling sad. A wagging tail is their way of saying hello!",
      "Taking care of a dog teaches us kindness, patience and responsibility — and playing with one makes everybody smile.",
    ],
    funFact: "A dog's sense of smell is up to 100,000 times stronger than yours!",
  },
  {
    slug: "how-trees-help-our-planet",
    image: cardTrees,
    title: "How Trees Help Our Planet",
    description: "Meet the trees that give us clean air and a healthy Earth.",
    minutes: 4,
    likes: 143,
    tint: "bg-leaf/20",
    category: "Nature",
    date: "Aug 14, 2025",
    edition: "Aug 14, 2025",
    paragraphs: [
      "Trees are like the lungs of our planet. They breathe in the air we breathe out and give back fresh oxygen for everyone — people, animals and even tiny bugs.",
      "Their roots hold the soil in place so rain does not wash it away, and their branches give homes to birds, squirrels and insects.",
      "Planting one small tree today can make shade, fruit and clean air for many, many years.",
    ],
    funFact: "One big tree can make enough oxygen for four people every day!",
  },
];

export const getStory = (slug: string) => stories.find((s) => s.slug === slug);
