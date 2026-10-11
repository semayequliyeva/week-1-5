import VirtualizedFeed from '../components/VirtualizedFeed';

export default function HomePage() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-100 dark:bg-gray-950">
      <VirtualizedFeed />
    </main>
  );
}