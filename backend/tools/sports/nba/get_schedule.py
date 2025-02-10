import logging

import requests

logger = logging.getLogger("uvicorn")

lookup_nba_schedule_def = {
    'type': 'function',
    'function': {
        'name': 'lookup_nba_schedule',
        'description': 'Lookup an NBA team\'s schedule',
        'parameters': {
            'type': 'object',
            'required': ['team_name'],
            'properties': {
                'team_name': {'type': 'string', 'description': 'The name of the NBA team to search for'},
                'date': {'type': 'string', 'description': 'The start date of the NBA schedule lookup.'},
            },
        },
    },
}


def lookup_nba_schedule(team_name: str, date: str) -> str:
    """Fetch NBA schedule from an API."""
    url = f"https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/{date}?key=YOUR_NBA_API_KEY"

    try:
        response = requests.get(url)
        response.raise_for_status()
        games = response.json()

        logger.info(games)

        # Filter games by team if provided
        if team_name:
            games = [game for game in games if game["HomeTeam"] == team_name or game["AwayTeam"] == team_name]

        if not games:
            return f"No games found for {team_name} on {date}."

        return "\n".join([f"{game['AwayTeam']} vs {game['HomeTeam']} at {game['DateTime']}" for game in games])

    except Exception as e:
        return f"Failed to fetch NBA schedule: {str(e)}"
