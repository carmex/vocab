import { wordsToNumber, areNumberWordsMatching } from './number-words.util';

describe('number-words.util', () => {
  describe('wordsToNumber', () => {
    it('should parse direct digit strings', () => {
      expect(wordsToNumber('25')).toBe(25);
      expect(wordsToNumber('0')).toBe(0);
      expect(wordsToNumber('-5')).toBe(-5);
      expect(wordsToNumber('+12')).toBe(12);
      expect(wordsToNumber('100')).toBe(100);
      expect(wordsToNumber('144')).toBe(144);
    });

    it('should parse single digit words', () => {
      expect(wordsToNumber('zero')).toBe(0);
      expect(wordsToNumber('oh')).toBe(0);
      expect(wordsToNumber('one')).toBe(1);
      expect(wordsToNumber('two')).toBe(2);
      expect(wordsToNumber('three')).toBe(3);
      expect(wordsToNumber('four')).toBe(4);
      expect(wordsToNumber('five')).toBe(5);
      expect(wordsToNumber('six')).toBe(6);
      expect(wordsToNumber('seven')).toBe(7);
      expect(wordsToNumber('eight')).toBe(8);
      expect(wordsToNumber('nine')).toBe(9);
    });

    it('should parse teens and tens', () => {
      expect(wordsToNumber('ten')).toBe(10);
      expect(wordsToNumber('eleven')).toBe(11);
      expect(wordsToNumber('twelve')).toBe(12);
      expect(wordsToNumber('thirteen')).toBe(13);
      expect(wordsToNumber('fourteen')).toBe(14);
      expect(wordsToNumber('fifteen')).toBe(15);
      expect(wordsToNumber('sixteen')).toBe(16);
      expect(wordsToNumber('seventeen')).toBe(17);
      expect(wordsToNumber('eighteen')).toBe(18);
      expect(wordsToNumber('nineteen')).toBe(19);
      expect(wordsToNumber('twenty')).toBe(20);
      expect(wordsToNumber('thirty')).toBe(30);
      expect(wordsToNumber('forty')).toBe(40);
      expect(wordsToNumber('fifty')).toBe(50);
      expect(wordsToNumber('sixty')).toBe(60);
      expect(wordsToNumber('seventy')).toBe(70);
      expect(wordsToNumber('eighty')).toBe(80);
      expect(wordsToNumber('ninety')).toBe(90);
    });

    it('should parse compound numbers with space or hyphen', () => {
      expect(wordsToNumber('twenty five')).toBe(25);
      expect(wordsToNumber('twenty-five')).toBe(25);
      expect(wordsToNumber('thirty seven')).toBe(37);
      expect(wordsToNumber('forty two')).toBe(42);
      expect(wordsToNumber('ninety nine')).toBe(99);
      expect(wordsToNumber('ninety-nine')).toBe(99);
    });

    it('should parse hundreds and larger numbers', () => {
      expect(wordsToNumber('one hundred')).toBe(100);
      expect(wordsToNumber('a hundred')).toBe(100);
      expect(wordsToNumber('hundred')).toBe(100);
      expect(wordsToNumber('one hundred five')).toBe(105);
      expect(wordsToNumber('one hundred and five')).toBe(105);
      expect(wordsToNumber('one hundred twenty five')).toBe(125);
      expect(wordsToNumber('one hundred and twenty-five')).toBe(125);
      expect(wordsToNumber('one hundred forty four')).toBe(144);
      expect(wordsToNumber('one hundred and forty four')).toBe(144);
    });

    it('should parse negative numbers', () => {
      expect(wordsToNumber('negative five')).toBe(-5);
      expect(wordsToNumber('minus five')).toBe(-5);
      expect(wordsToNumber('negative twenty five')).toBe(-25);
      expect(wordsToNumber('minus twenty-five')).toBe(-25);
      expect(wordsToNumber('negative 25')).toBe(-25);
      expect(wordsToNumber('minus 25')).toBe(-25);
    });

    it('should handle speech filler words and punctuation', () => {
      expect(wordsToNumber("it's twenty five")).toBe(25);
      expect(wordsToNumber('the answer is twenty five')).toBe(25);
      expect(wordsToNumber('um twenty five')).toBe(25);
      expect(wordsToNumber('twenty five.')).toBe(25);
      expect(wordsToNumber('twenty five!')).toBe(25);
    });

    it('should handle common speech homophones for numbers', () => {
      expect(wordsToNumber('won')).toBe(1);
      expect(wordsToNumber('too')).toBe(2);
      expect(wordsToNumber('twenty too')).toBe(22);
      expect(wordsToNumber('twenty for')).toBe(24);
      expect(wordsToNumber('twenty ate')).toBe(28);
    });

    it('should return null for non-numeric phrases', () => {
      expect(wordsToNumber('cat')).toBeNull();
      expect(wordsToNumber('apple')).toBeNull();
      expect(wordsToNumber('hello world')).toBeNull();
      expect(wordsToNumber('')).toBeNull();
      expect(wordsToNumber('   ')).toBeNull();
      expect(wordsToNumber('twenty cat')).toBeNull();
      expect(wordsToNumber('five five')).toBeNull();
    });
  });

  describe('areNumberWordsMatching', () => {
    it('should match spoken words to digit strings', () => {
      expect(areNumberWordsMatching('twenty five', '25')).toBe(true);
      expect(areNumberWordsMatching('twenty-five', '25')).toBe(true);
      expect(areNumberWordsMatching('25', 'twenty five')).toBe(true);
      expect(areNumberWordsMatching('one hundred forty four', '144')).toBe(true);
      expect(areNumberWordsMatching('negative five', '-5')).toBe(true);
      expect(areNumberWordsMatching('minus five', '-5')).toBe(true);
      expect(areNumberWordsMatching('zero', '0')).toBe(true);
      expect(areNumberWordsMatching('oh', '0')).toBe(true);
    });

    it('should reject different numbers', () => {
      expect(areNumberWordsMatching('twenty four', '25')).toBe(false);
      expect(areNumberWordsMatching('twenty five', '5')).toBe(false);
      expect(areNumberWordsMatching('5', '25')).toBe(false);
      expect(areNumberWordsMatching('15', '50')).toBe(false);
    });

    it('should return false if either input is not a number', () => {
      expect(areNumberWordsMatching('cat', '25')).toBe(false);
      expect(areNumberWordsMatching('25', 'dog')).toBe(false);
      expect(areNumberWordsMatching('cat', 'dog')).toBe(false);
    });
  });
});
