import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React, { useState } from 'react';

import { Chip, ChipGroup } from '@/presentation/components';

const OPTIONS = ['Books', 'Running', 'Design'];

/** A group wired the way a screen wires it: the selection lives in state. */
function Picker({ selectionLabel }: { selectionLabel?: string }): React.JSX.Element {
  const [picked, setPicked] = useState<string[]>(['Running']);
  const toggle = (option: string) =>
    setPicked((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
    );

  return (
    <ChipGroup {...(selectionLabel ? { selectionLabel } : {})}>
      {OPTIONS.map((option) => (
        <Chip
          key={option}
          label={option}
          selected={picked.includes(option)}
          onPress={() => toggle(option)}
          testID={`chip-${option}`}
        />
      ))}
    </ChipGroup>
  );
}

describe('ChipGroup', () => {
  it('repeats the chosen chips under the selection label', () => {
    render(<Picker selectionLabel="My selection" />);

    expect(screen.getByText('My selection')).toBeTruthy();
    const selection = screen.getByTestId('chip-selection');
    expect(within(selection).getByText('Running')).toBeTruthy();
    expect(within(selection).queryByText('Books')).toBeNull();

    // The copy carries no testID, so the list chip is still found exactly once.
    expect(screen.getAllByTestId('chip-Running')).toHaveLength(1);
  });

  it('deselects from the selection group, and hides it when it is empty', () => {
    render(<Picker selectionLabel="My selection" />);

    fireEvent.press(within(screen.getByTestId('chip-selection')).getByText('Running'));

    expect(screen.queryByTestId('chip-selection')).toBeNull();
    expect(screen.queryByText('My selection')).toBeNull();
    expect(screen.getByTestId('chip-Running').props.accessibilityState).toMatchObject({
      checked: false,
    });
  });

  it('shows no selection group without a label', () => {
    render(<Picker />);

    expect(screen.queryByTestId('chip-selection')).toBeNull();
  });
});
