import datetime

from duckduckgo_search import DDGS

lookup_nba_schedule_def = {
    'name': 'lookup_nba_schedule',
    'description': 'Retrieve schedule details for an NBA team',
    'parameters': {
        'type': 'dict',
        'required': ['team_name'],
        'properties': {
            'team_name': {'type': 'string', 'description': 'The name of the NBA team to search for'},
            'date': {
                'type': 'string',
                'description': 'The day of the NBA event. It is used to narrow down a schedule to a specific day',
                'default': datetime.date.today().strftime('%Y-%m-%d')
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
