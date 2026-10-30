import dayjs from "dayjs";
import moment from "moment";

export function formatOrderDate(date: Date): string {
  return dayjs(date).format("DD/MM/YYYY");
}

export function formatLegacyDate(date: Date): string {
  return moment(date).format("L");
}
