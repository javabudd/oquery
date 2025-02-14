from tools.sports.nba.get_schedule import lookup_nba_schedule, lookup_nba_schedule_def

AVAILABLE_FUNCTIONS = {
    'get_nba_schedule': (lookup_nba_schedule_def, lookup_nba_schedule),
    'lookup_nba_schedule': (lookup_nba_schedule_def, lookup_nba_schedule),
    'nbaSchedule': (lookup_nba_schedule_def, lookup_nba_schedule),
}
