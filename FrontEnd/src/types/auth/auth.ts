import { ReactElement } from 'react';

export interface registerType {
  title?: string;
  subtitle?: ReactElement | ReactElement[];
  subtext?: ReactElement | ReactElement[];
}

export interface loginType {
  title?: string;
  subtitle?: ReactElement | ReactElement[];
  subtext?: ReactElement | ReactElement[];
}

export interface signInType {
  title?: string;
}
