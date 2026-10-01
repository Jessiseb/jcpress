package com.jcpress.infrastructure.gson;

import com.google.gson.TypeAdapter;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonToken;
import com.google.gson.stream.JsonWriter;

import java.io.IOException;

/**
 * {@code Long} 一律以**字符串**下发。
 *
 * 原因：JavaScript 的安全整数上限是 2^53-1，自增/雪花 ID 直接下发会静默失真（规划 §5.4）。
 * 前端的类型定义因此把 ID 声明为 {@code string}。
 */
public class LongToStringAdapter extends TypeAdapter<Long> {

    @Override
    public void write(JsonWriter out, Long value) throws IOException {
        if (value == null) {
            out.nullValue();
            return;
        }
        out.value(String.valueOf(value));
    }

    @Override
    public Long read(JsonReader in) throws IOException {
        if (in.peek() == JsonToken.NULL) {
            in.nextNull();
            return null;
        }
        return Long.valueOf(in.nextString());
    }
}
