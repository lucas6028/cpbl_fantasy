-- One-time backfill for leagues with completed drafts.
-- Safe to run multiple times (uses upsert).

with completed_leagues as (
    select dp.league_id
    from draft_picks dp
    group by dp.league_id
    having count(*) > 0
       and count(*) filter (where dp.player_id is null) = 0
), completed_picks as (
    select
        dp.league_id,
        dp.player_id,
                dp.manager_id::bigint as manager_id,
        coalesce(dp.picked_at, now()) as acquired_at
    from draft_picks dp
    join completed_leagues cl on cl.league_id = dp.league_id
    where dp.player_id is not null
            and dp.manager_id is not null
            and dp.manager_id ~ '^[0-9]+$'
)
insert into league_player_ownership (
    league_id,
    player_id,
    manager_id,
    status,
    acquired_at,
    off_waiver
)
select
    cp.league_id,
    cp.player_id,
    cp.manager_id,
    'On Team',
    cp.acquired_at,
    null
from completed_picks cp
on conflict (league_id, player_id)
do update set
    manager_id = excluded.manager_id,
    status = 'On Team',
    acquired_at = excluded.acquired_at,
    off_waiver = null;

-- Optional status sync for fully completed drafts not already in-season.
with completed_leagues as (
        select dp.league_id
        from draft_picks dp
        group by dp.league_id
        having count(*) > 0
             and count(*) filter (where dp.player_id is null) = 0
)
update league_statuses ls
set status = 'post-draft & pre-season'
where ls.league_id in (select league_id from completed_leagues)
  and ls.status not in ('post-draft & pre-season', 'in-season');
