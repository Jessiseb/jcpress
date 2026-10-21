---
title: Java 线程基础：进程与线程、创建方式与中断
slug: java-thread-basics
type: TECH
category: java-backend
tags: [Java, 并发, 线程]
summary: 从启动一个 Java 程序看进程与线程的分工，三种创建线程的方式与它们的取舍，线程优先级为什么不能当同步手段，以及停止线程为什么只能靠中断。
status: PUBLISHED
publishTime: 2026-10-20 19:30:00
---
# Java 线程基础：进程与线程、创建方式与中断

Java 并发的内容很多，但最初绕不开的就四件事：进程和线程分别是什么、线程怎么创建、优先级有没有用、线程怎么停下来。这篇是这块的整理，几处容易记错的地方单独标了出来。

## 进程与线程

进程是操作系统**分配资源**的基本单位，线程是**处理器调度**的基本单位。

从 Java 程序看：

- 启动一个 Java 程序（`java -jar xxx.jar`），操作系统会创建一个 Java 进程；
- 一个进程里可以创建多个线程，所以 Java 程序里可以自己定义多个线程；
- 这些线程各有独立的**程序计数器、虚拟机栈和局部变量**，但共享堆内存、方法区和进程打开的文件等资源。

最后一句是并发的麻烦之源：栈是各管各的，堆上的对象是共用的。多个线程同时读写同一个对象，就需要额外的手段保证可见性和原子性。

## 线程优先级

操作系统基本按**时间分片**把处理器时间分配给线程：一个线程用完当前时间片就要让出处理器，哪怕任务还没跑完，也得等下一次被调度。分到的时间片越多，能用的处理器资源越多。

优先级就是用来表达「多分还是少分」的属性：

- Java 用 `setPriority(int)` 设置，范围 **1–10**，默认 **5**（`Thread.NORM_PRIORITY`）；
- 经验做法：**频繁阻塞**的线程给高优先级（它大部分时间在等，给高一点便于醒来时被优先调度）；**计算密集、长时间占 CPU** 的线程给低优先级，避免独占处理器。

两个必须知道的限制：

1. **优先级只是建议，不是保证。** 它不决定线程谁先跑、跑多久，也不能替代任何同步手段。
2. **跨平台差别很大。** 在 Linux 上，JVM 默认不会把 Java 优先级传给内核（需要特定启动参数且通常要 root），所以 `setPriority` 基本无效；Windows 上则部分生效。指望靠优先级来保证执行顺序，在服务器上跑一遍就会发现问题。

## 创建线程的三种方式

### 实现 Runnable 接口

写一个类实现 `Runnable`、重写 `run()`，再把实例交给 `Thread`：

```java
public class RunnableThread implements Runnable {
    @Override
    public void run() {
        System.out.println("用实现 Runnable 接口的方式创建线程");
    }

    public static void main(String[] args) {
        RunnableThread task = new RunnableThread();
        Thread thread = new Thread(task);
        thread.start();
    }
}
```

### 实现 Callable 接口

`Callable` 与 `Runnable` 的区别是**有返回值**，并且可以抛受检异常。返回值由 `FutureTask` 封装：

```java
public class MyCallable implements Callable<Integer> {
    @Override
    public Integer call() throws Exception {
        Thread.sleep(1000);
        return 42;
    }

    public static void main(String[] args) throws Exception {
        FutureTask<Integer> futureTask = new FutureTask<>(new MyCallable());
        Thread thread = new Thread(futureTask);
        thread.start();

        // get() 会阻塞到任务结束；任务里抛了异常，这里会包成 ExecutionException
        Integer result = futureTask.get();
        System.out.println(result);
    }
}
```

注意 `Callable` 是接口（`implements`），`Thread` 的构造器只认 `Runnable`，所以要靠 `FutureTask` 这层适配 —— 它同时实现了 `Runnable` 和 `Future`。

### 继承 Thread 类

```java
public class MyThread extends Thread {
    @Override
    public void run() {
        System.out.println("用继承 Thread 类的方式创建线程");
    }

    public static void main(String[] args) {
        MyThread thread = new MyThread();
        thread.start();
    }
}
```

### 为什么更推荐实现接口

`Runnable` / `Callable` 只描述「一段可以被线程执行的任务」，本身不是线程，最终还是要 `new Thread(task).start()` 来驱动。推荐实现接口有三个理由：

1. **Java 不支持多继承。** 继承了 `Thread` 就不能再继承别的类，而一个类实现多个接口没有这个限制。
2. **继承整个 Thread 类开销过大。** 很多时候要的只是「这段代码能被执行」，不需要重写线程的行为。
3. **线程池只接收任务。** `ExecutorService.submit()` 的参数是 `Runnable` 或 `Callable`，`Thread` 的子类塞不进去 —— 真要用线程池时，继承 Thread 的写法就得改写。

## 中断与终止

### 中断是标志位，不是命令

中断可以理解为线程身上的一个**标志位**：表示这个线程是否被其他线程请求过中断。相关方法有三个，容易混：

| 方法 | 作用 | 是否清除标志 |
| --- | --- | --- |
| `thread.interrupt()` | 给目标线程置中断标志 | 否 |
| `thread.isInterrupted()` | 查询目标线程的标志 | 否 |
| `Thread.interrupted()` | **静态方法**，查询当前线程的标志 | **是** |

第三行是最容易记错的：`Thread.interrupted()` 是静态方法，作用对象是**当前线程**，而且调用一次就把标志清掉了。想反复检查同一个线程的状态，用 `isInterrupted()`。

还有一种情况要单独记：如果线程正阻塞在 `sleep`、`wait`、`join` 上，`interrupt()` 会让它立刻抛 `InterruptedException`，**并清除标志位**。所以捕获到 `InterruptedException` 之后，标志位已经没了，需要自己恢复。

### 为什么线程不应该被强制停止

基于中断的停止模式是这样的：A 想停 B，A 给 B 发一个中断信号，B 自己检查标志位，然后决定怎么响应 —— 可以立刻停、可以把手上的事做完再停、也可以完全忽略。

为什么要把决定权交给 B？因为只有 B 知道自己走到哪一步了。

设想 B 正在写一个文件，写到一半被 A 强行打断：文件是残缺的，锁也可能被突然释放，别的线程接着读到的就是半份数据。要让 B 稳妥地停下，A 只能「请求」，不能「执行」。中断就是这个请求。

JDK 早期确实提供过强制终止的 `Thread.stop()`，它的做法是抛一个 `ThreadDeath` 让线程当场死掉，不管线程正在做什么，也不管它持有哪些锁。这正是上面那种事故的制造方式，所以 `stop()` 早已被标记为废弃，不该再出现在代码里。

对应的正确写法是：任务里定期检查中断，或者捕获 `InterruptedException` 后不要把异常吞掉 —— 至少恢复标志位，把中断继续往上传递：

```java
try {
    while (!Thread.currentThread().isInterrupted()) {
        doOnePieceOfWork();
    }
} finally {
    releaseResources();
}
```

```java
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    // 不吞异常：恢复标志位，交给上层决定怎么收尾
    Thread.currentThread().interrupt();
    return;
}
```

## 几条容易记错的点

- `interrupt()` 不会真的「打断」正在跑的业务代码，它只是置位；线程不检查标志位，中断就没有效果。
- `Thread.interrupted()` 是静态方法且会清除标志，判断目标线程的状态要用 `isInterrupted()`。
- `sleep` / `wait` / `join` 抛 `InterruptedException` 时会清除标志位，所以捕获后要恢复。
- `setPriority` 在 Linux 上基本无效，不能当同步或调度手段用。
- `Callable` 有返回值，但必须配 `FutureTask` 才能交给 `Thread`；要拿结果还是走线程池的 `submit()` 更直接。
