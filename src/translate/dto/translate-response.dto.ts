export interface ExampleSentence {
  sentence: string;
  translation: string;
}

export interface TranslateResponseDto {
  translation: string;
  pronunciation: string;
  example: ExampleSentence;
}
