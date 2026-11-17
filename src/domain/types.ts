// Modelo de datos v2 (spec 010, sección 3). Solo tipos: sin lógica ni dependencias de Expo o React Native.
//
// Fechas: texto "AAAA-MM-DD" en hora local del teléfono. Horas del día: minutos desde la medianoche (0 a 1440).

/** Tokens de la paleta cerrada de colores. Los valores concretos (claro y oscuro) los define el tema. */
export type ColorToken = 'blue' | 'pink' | 'teal' | 'green' | 'amber' | 'slate' | 'gray';

/** 3.1 Categoría. El comportamiento sale de sus propiedades, no de su nombre. */
export interface Category {
  id: string;
  name: string;
  color: ColorToken;
  /** `false` = fija: el margen no la mueve ni la cruza. */
  movable: boolean;
  /** `true` = ofrece Empezar, timer y el botón "Empecé" en el aviso. */
  tracked: boolean;
  /** `avoid` = no se propone por defecto para recibir margen. */
  marginPreference: 'normal' | 'avoid';
  archived: boolean;
}

/** 3.2 Regla de repetición semanal. */
export interface Rule {
  /** Días de la semana, 0 = domingo … 6 = sábado. */
  weekdays: number[];
  /** 1 = cada semana, 2 = cada dos semanas, … */
  everyWeeks: number;
}

/** Aviso propio de un evento. `null` en la serie = usar los valores de Ajustes. */
export interface SeriesReminder {
  atStart: boolean;
  /** Minutos antes del fin. 0 = sin aviso de fin. */
  endLead: number;
}

/** 3.2 Serie de eventos: un evento que se repite, o de un solo día si `rule` es `null`. */
export interface Series {
  id: string;
  title: string;
  categoryId: string;
  startMin: number;
  endMin: number;
  note: string;
  rule: Rule | null;
  /** Primer día en que puede ocurrir. */
  startDate: string;
  /** Último día en que puede ocurrir. `null` = sin fin. */
  endDate: string | null;
  reminder: SeriesReminder | null;
  archived: boolean;
}

/** Campos de una serie que una excepción puede cambiar para un día. */
export type ExceptionFields = Partial<Pick<Series, 'title' | 'categoryId' | 'startMin' | 'endMin' | 'note'>>;

/** 3.3 Cambio que afecta a una sola fecha de una serie. Como máximo uno por serie y fecha. */
export type SeriesException =
  | { seriesId: string; date: string; kind: 'cancelled' }
  | { seriesId: string; date: string; kind: 'modified'; fields: ExceptionFields };

/** 3.5 Parte de una meta que cambia con el tiempo. La vigente un día es la última con `effectiveFrom` ≤ ese día. */
export interface GoalVersion {
  effectiveFrom: string;
  /** `null` = se cuenta sin objetivo. */
  target: number | null;
  period: 'day' | 'week';
  /** Días de la semana en que aplica, 0 = domingo … 6 = sábado. */
  activeDays: number[];
}

/** 3.5 Meta. */
export interface Goal {
  id: string;
  name: string;
  kind: 'quantity' | 'time' | 'both';
  /** "comentarios", "páginas". Vacío si es solo de tiempo. */
  unit: string;
  /** Ids de series asociadas. Vacía = meta global. */
  links: string[];
  /** Hora del aviso propio, "HH:MM", o `null`. */
  reminder: string | null;
  archived: boolean;
  /** Ordenadas por `effectiveFrom`, al menos una. */
  versions: GoalVersion[];
}

/** 3.6 Plantilla: categorías, series y metas que se aplican de una vez (copiándolas con ids nuevos). */
export interface Template {
  id: string;
  name: string;
  description: string;
  language: string;
  categories: Category[];
  /**
   * Series con ids locales de la plantilla. `startDate` no se usa: al aplicar, cada serie empieza en la semana elegida
   * más `weekOffset` semanas (sirve para las reglas de cada dos semanas).
   */
  series: (Omit<Series, 'startDate' | 'endDate'> & { weekOffset: number })[];
  goals: Goal[];
}

/** 3.8 Ajustes v2: sin ancla global; `muted` por id de serie. */
export interface SettingsV2 {
  notifStart: boolean;
  endLead: number;
  wake: boolean;
  muted: Record<string, boolean>;
}

/** Todo el modelo v2 de la agenda, tal como lo guarda la capa de acceso. */
export interface AgendaState {
  categories: Category[];
  series: Series[];
  exceptions: SeriesException[];
  goals: Goal[];
  /**
   * Ids nuevos creados por la migración → id original (`bid`) que usa el registro histórico.
   * Solo aparecen series que tuvieron que separarse o renombrarse (010, 4.2, caso difícil).
   */
  legacyBid: Record<string, string>;
}

/** Un evento ya ubicado en un día (resultado de armar el día). Mismos campos cortos que el `Block` actual. */
export interface DayBlock {
  /** Id de la serie. */
  id: string;
  date: string;
  s: number;
  e: number;
  t: string;
  /** Id de categoría. */
  c: string;
  n: string;
  /** `true` si una excepción cambió algún campo ese día. */
  modified: boolean;
}
