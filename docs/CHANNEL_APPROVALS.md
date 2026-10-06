# Channel approval decisions and glossary — Refs #12

Issue #12 replaces automatic publication of newly discovered YouTube identities with manager review. This implementation is local and awaits release approval. Existing production behavior described in Issue #10 history has not yet been changed by deployment.

| Term | Meaning |
| --- | --- |
| Candidate / pending | Resolved YouTube identity awaiting manager review; absent from public channel lists and rankings. |
| Approved | Manager selected affiliation and saved reviewed channel metadata. Valid statistics may also create a snapshot. |
| Ignored | Reviewed identity excluded from the pending queue; discovery preserves its tombstone. |
| Search hint | Query/video evidence suggesting a possible channel. It does not confirm Thai VTuber identity, debut or activity. |
| Profile evidence | Literal YouTube description and source URL. Ambiguous claims remain for human review. |
| Sweep | Resumable daily query/page/item traversal; exhaustion follows nextPageToken. |
| New candidates | Cumulative additions in a discovery run, including its resumptions. |
| Pending total | Current pending count for the queue's name filter. It is not the cumulative run count. |

The manager-only lazy route is `/admin/channel-approvals` (ช่องรออนุมัติ). Settings retains daily controls and run history; review actions live on the queue page. Search submits a name filter and resets to page one; pages contain at most 20 rows. Approval uses the existing channel editor with explicit blank affiliation and immutable canonical YouTube URLs/platform. Reviewed draft fields may be edited; an agency requires an existing agency selection. Missing/hidden statistics yield metadata-only approval rather than invented zero counters. Stale conflicts remain errors and ask the manager to refresh.

New `/youtube/import` and YouTube `/vtubers` requests return `202 {ok:true,queued:true,channel_id,name}`. Their UI announces waiting without reloading the public channel table or claiming publication. Existing imports/edits retain saved behavior. Staff can submit imports but cannot access the queue or its manager actions. The backend remains the authorization boundary.

The queue reads `GET /directory-candidates?q=&limit=20&offset=0` as `{results,total,limit,offset}`. Evidence/profile/review fields are JSON strings. Links require HTTPS and a YouTube host allowlist. React escapes literal evidence. Approve accepts flat channelFields at `POST /directory-candidates/:id/approve`, returns `201 {ok:true,id,channel_id,snapshot}`; ignore is `POST .../ignore`. Both preserve CSRF. Stale is 409; missing is 404.

`GET /directory-sync` exposes `{runs,candidates,sweep}`. The UI displays snake_case run counters and sweep query_index/remaining_items/completed without a hardcoded query denominator. YouTube Search is bounded by queries and service limits, so a completed sweep never promises an exhaustive list of Thai VTubers. Profiles refresh fairly across the registered channel cursor and preserve editorial/source ownership guards.

Release requires migrations 0011 and 0012 and separately approved Pages/Worker deployment. Local tests and synthetic screenshots contain no production data. No release or issue closure is authorized by this document.
