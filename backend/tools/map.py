from tools.sports.nba.get_schedule import lookup_nba_schedule, lookup_nba_schedule_def

AVAILABLE_FUNCTIONS = {
    'lookup_nba_schedule': (lookup_nba_schedule_def, lookup_nba_schedule),
}
