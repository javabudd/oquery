from duckduckgo_search import DDGS

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
    """Query DuckDuckGo for NBA schedule and return formatted search results."""
    if team_name == '' or date == '':
        return ""
    try:
        with DDGS() as ddgs:
            results = ddgs.text(team_name, max_results=1)  # Get top 1 result
        if results:
            return "\n".join([f"{r['title']} - {r['href']}" for r in results])
        return "No relevant NBA schedule results found."
    except Exception as e:
        return f"Failed to find NBA schedule: {str(e)}"
