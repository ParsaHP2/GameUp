// Fetch recommended games from RAWG API (external gaming database)
// Returns top-rated games to display in stats screen
export const fetchRecommendedGames = async () => {
  // Get API key from environment variable or use default
  const apiKey = process.env?.EXPO_PUBLIC_RAWG_API_KEY || '1861e88856f64399a63278d68bfeddf6';
  // Build API URL - get top 3 games sorted by rating
  let url = 'https://api.rawg.io/api/games?ordering=-rating&page_size=3';

  if (apiKey) {
    url += `&key=${apiKey}`;
  }

  try {
    // Fetch games from RAWG API
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`RAWG request failed with status ${response.status}`);
    }

    // Parse JSON response
    const data = await response.json();
    if (!data?.results) {
      return [];
    }

    // Transform API response to our format
    return data.results.map((game) => ({
      id: game.id,
      name: game.name,
      backgroundImage: game.background_image,
      genres: Array.isArray(game.genres) ? game.genres.map((g) => g.name) : [], // Extract genre names
      metacritic: game.metacritic, // Metacritic score (0-100)
      rating: game.rating, // User rating
    }));
  } catch (error) {
    console.warn('Failed to fetch RAWG recommendations:', error.message);
    return []; // Return empty array on error
  }
};

