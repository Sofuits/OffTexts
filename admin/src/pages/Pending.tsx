import React from 'react';

/**
 * A section whose database table does not exist yet.
 *
 * Deliberately not a mock. A table of invented cafés would look finished, and
 * the first person to rely on it would find out the hard way. This says what
 * the section is for, what has to exist before it can work, and what decision
 * is outstanding — which is genuinely more useful to a reviewer than fake rows.
 */
export function Pending({
  title,
  lede,
  needs,
  open,
}: {
  title: string;
  lede: string;
  /** What has to be built. */
  needs: string[];
  /** Product decisions nobody has made yet. */
  open: string[];
}): React.JSX.Element {
  return (
    <>
      <h1>{title}</h1>
      <p className="lede">{lede}</p>

      <div className="state" style={{ textAlign: 'left' }}>
        <h3>Not built yet</h3>
        <p style={{ marginLeft: 0 }}>
          This section has no database table behind it. It is here so the navigation is complete and
          the shape of the work is visible — not as a placeholder to be filled in with sample data.
        </p>
      </div>

      <h2>What it needs</h2>
      <div className="card">
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--c-text-secondary)' }}>
          {needs.map((item) => (
            <li key={item} style={{ marginBottom: 6 }}>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <h2>Open questions</h2>
      <div className="card">
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--c-text-secondary)' }}>
          {open.map((item) => (
            <li key={item} style={{ marginBottom: 6 }}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function Cafes(): React.JSX.Element {
  return (
    <Pending
      title="Cafés"
      lede="Partner venues where meets happen, and who to call at each one."
      needs={[
        'A cafes table: name, area, address, opening hours, capacity, status.',
        'A manager contact on each: name, phone, email.',
        'A foreign key from meets.venue to a café — today venue_name and venue_area are free text typed by whoever created the meet.',
        'Staff read and write policies, the same is_staff() pattern as migration 0003.',
      ]}
      open={[
        'Does a café have one manager or several contacts?',
        'Is a partnership a status on the café, or a separate agreement record with dates?',
        'Who confirms a booking with the venue — the app, or a person?',
        'Should a member ever see the café address before a meet is confirmed?',
      ]}
    />
  );
}

export function SafetyCases(): React.JSX.Element {
  return (
    <Pending
      title="Safety cases"
      lede="Reports raised by members about a meet or another member."
      needs={[
        'A safety_cases table: who reported it, who or what it concerns, the meet it relates to, a category, a status and a written account.',
        'A way for a member to raise one from the phone app — there is no report button anywhere today.',
        'Staff read and write policies, plus a rule that a member can see only the cases they raised.',
        'An audit trail: who changed a case status and when. Unlike the rest of the app, this data may end up in a serious conversation.',
      ]}
      open={[
        'What are the categories, and who decides them?',
        'What happens to a member while a case about them is open — are they hidden from discovery automatically?',
        'Who is on call for a serious report, and what is the expected response time?',
        'How long are closed cases kept, and does the member who raised one have a right to delete it?',
      ]}
    />
  );
}
