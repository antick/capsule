import Charts
import CapsuleCore
import CapsuleDock
import SwiftUI

/// Each meter's windows over the last week, one chart per meter.
struct HistoryPage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let now = Date()
    VStack(spacing: 16) {
      PageHeader(title: Copy.history, description: Copy.historyHint)
      let readings = model.snapshots.filter { !$0.buckets.isEmpty }
      if readings.isEmpty || model.history.isEmpty {
        SettingsSection { Text(Copy.noHistoryYet).font(.system(size: 12.5)).foregroundStyle(.secondary) }
      }
      ForEach(readings, id: \.meterId) { snapshot in
        let lines = snapshot.buckets.map { bucket in
          (bucket.label, chartSamples(model.history, MetricKey(snapshot.meterId, bucket.id), now: now))
        }.filter { !$0.1.isEmpty }
        if !lines.isEmpty {
          SettingsSection {
            HStack(spacing: 8) {
              ProviderMark(id: snapshot.providerId, tint: .primary).frame(width: 15, height: 15)
              Text(snapshot.displayName).font(.system(size: 13.5, weight: .medium))
            }
            Chart {
              ForEach(lines, id: \.0) { label, samples in
                ForEach(samples, id: \.at) { sample in
                  LineMark(
                    x: .value("Time", Date(timeIntervalSince1970: sample.at)), y: .value("Used", sample.percent)
                  )
                  .foregroundStyle(by: .value("Window", label))
                  .interpolationMethod(.stepEnd)
                }
              }
            }
            .chartYScale(domain: 0...100)
            .chartXScale(domain: now.addingTimeInterval(-HistoryTuning.chartSeconds)...now)
            .chartXAxis {
              AxisMarks(values: .stride(by: .day)) { value in
                AxisGridLine()
                AxisValueLabel { if let day = value.as(Date.self) { Text(formatChartDay(day)) } }
              }
            }
            .chartYAxis {
              AxisMarks(values: [0, 50, 100]) { value in
                AxisGridLine()
                AxisValueLabel { if let percent = value.as(Int.self) { Text("\(percent)\(Copy.percentSuffix)") } }
              }
            }
            .frame(height: HistoryTuning.chartHeight)
            .accessibilityLabel("\(snapshot.displayName) \(Copy.history)")
          }
        }
      }
    }
  }
}
