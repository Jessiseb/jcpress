package com.jcpress.infrastructure.gson;

import com.google.gson.TypeAdapter;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonToken;
import com.google.gson.stream.JsonWriter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * {@code LocalDateTime} ↔ {@code yyyy-MM-dd HH:mm:ss}。
 *
 * Gson 默认不认 {@code java.time}，不注册这个适配器会序列化成一堆嵌套字段（规划 §5.4）。
 */
public class LocalDateTimeAdapter extends TypeAdapter<LocalDateTime> {

    public static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public void write(JsonWriter out, LocalDateTime value) throws IOException {
        if (value == null) {
            out.nullValue();
            return;
        }
        out.value(FORMATTER.format(value));
    }

    @Override
    public LocalDateTime read(JsonReader in) throws IOException {
        if (in.peek() == JsonToken.NULL) {
            in.nextNull();
            return null;
        }
        return LocalDateTime.parse(in.nextString(), FORMATTER);
    }
}
