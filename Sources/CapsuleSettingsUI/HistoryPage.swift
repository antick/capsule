import Charts
import CapsuleCore
import CapsuleDock
import SwiftUI

/// Each meter's windows over the last week, one chart per meter.
struct HistoryPage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let now = Date()
    SettingsForm(lead: Copy.historyHint) {
      let readings = model.snapshots.filter { !$0.buckets.isEmpty }
      if readings.isEmpty || model.history.isEmpty {
        Section { Text(Copy.noHistoryYet).foregroundStyle(.secondary) }
      }
      ForEach(readings, id: \.meterId) { snapshot in
        let lines = snapshot.buckets.map { bucket in
          (bucket.label, chartSamples(model.history, MetricKey(snapshot.meterId, bucket.id), now: now))
        }.filter { !$0.1.isEmpty }
        if !lines.isEmpty {
          Section {
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
            .padding(.vertical, 6)
            .accessibilityLabel("\(snapshot.displayName) \(Copy.history)")
          } header: {
            HStack(spacing: 8) {
              ProviderBadge(id: snapshot.providerId, size: 20)
              Text(snapshot.displayName)
            }
          }
        }
      }
    }
  }
}
