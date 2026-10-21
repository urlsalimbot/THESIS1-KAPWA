import { displayFullName, middleInitialOf } from './person-name';

describe('person-name display', () => {
  it('shows the middle name in full on application screens', () => {
    expect(
      displayFullName({ firstName: 'Pedro', middleName: 'Poblete', surname: 'Reyes' }),
    ).toBe('Pedro Poblete Reyes');
    expect(
      displayFullName({ firstName: 'Ana Marie', middleName: 'Lontok', surname: 'Fernandez' }),
    ).toBe('Ana Marie Lontok Fernandez');
  });

  it('drops the middle name cleanly when the person has none', () => {
    expect(displayFullName({ firstName: 'Rosario', middleName: null, surname: 'Mendoza' })).toBe(
      'Rosario Mendoza',
    );
    expect(displayFullName({ firstName: 'Rosario', middleName: '  ', surname: 'Mendoza' })).toBe(
      'Rosario Mendoza',
    );
  });

  it('keeps the suffix and never double-spaces', () => {
    expect(
      displayFullName({ firstName: 'Juan', middleName: 'Dizon', surname: 'Dela Cruz', nameExtension: 'Jr.' }),
    ).toBe('Juan Dizon Dela Cruz Jr.');
  });

  it('still offers the initial only for the documents designed to print one', () => {
    expect(middleInitialOf('Poblete')).toBe('P.');
    expect(middleInitialOf(null)).toBe('');
  });
});
