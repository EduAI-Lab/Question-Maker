const { describe, it, expect } = require('@jest/globals');

describe('Basic Math Tests', () => {
  it('should add two numbers correctly', () => {
    expect(2 + 2).toBe(4);
  });

  it('should multiply two numbers correctly', () => {
    expect(3 * 4).toBe(12);
  });

  it('should handle string concatenation', () => {
    expect('Hello' + ' ' + 'World').toBe('Hello World');
  });
});

describe('Array Tests', () => {
  it('should find items in array', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr.includes(3)).toBe(true);
    expect(arr.includes(6)).toBe(false);
  });

  it('should filter array correctly', () => {
    const numbers = [1, 2, 3, 4, 5, 6];
    const evenNumbers = numbers.filter(n => n % 2 === 0);
    expect(evenNumbers).toEqual([2, 4, 6]);
  });
});

describe('Object Tests', () => {
  it('should create and access object properties', () => {
    const user = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    };
    
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
    expect(user.age).toBe(30);
  });

  it('should handle object destructuring', () => {
    const person = { firstName: 'Jane', lastName: 'Smith' };
    const { firstName, lastName } = person;
    
    expect(firstName).toBe('Jane');
    expect(lastName).toBe('Smith');
  });
});
